var sendVerificationEmail = function(req, res, options) {
  req.app.utility.sendmail(req, res, {
    from: req.app.config.smtp.from.name +' <'+ req.app.config.smtp.from.address +'>',
    to: options.email,
    subject: 'Verify Your '+ req.app.config.projectName +' Account',
    textPath: 'account/verification/email-text',
    htmlPath: 'account/verification/email-html',
    locals: {
      verifyURL: req.protocol +'://'+ req.headers.host +'/account/verification/' + options.verificationToken,
      projectName: req.app.config.projectName
    },
    success: function() {
      options.onSuccess();
    },
    error: function(err) {
      options.onError(err);
    }
  });
};

var account = {
  getAccountDetails: function(req, res, next){
    var outcome = {};

    var getAccountData = function(callback) {
      req.app.db.models.Account.findById(req.user.roles.account.id, 'name company phone zip').exec(function(err, account) {
        if (err) {
          return callback(err, null);
        }

        outcome.account = account;
        callback(null, 'done');
      });
    };

    var getUserData = function(callback) {
      req.app.db.models.User.findById(req.user.id, 'username email twitter.id github.id facebook.id google.id tumblr.id').exec(function(err, user) {
        if (err) {
          callback(err, null);
        }

        outcome.user = user;
        return callback(null, 'done');
      });
    };

    var asyncFinally = function(err, results) {
      if (err) {
        return next(err);
      }
      res.status(200).json(outcome);

      //res.render('account/settings/index', {
      //  data: {
      //    account: escape(JSON.stringify(outcome.account)),
      //    user: escape(JSON.stringify(outcome.user))
      //  },
      //  oauthMessage: oauthMessage,
      //  oauthTwitter: !!req.app.config.oauth.twitter.key,
      //  oauthTwitterActive: outcome.user.twitter ? !!outcome.user.twitter.id : false,
      //  oauthGitHub: !!req.app.config.oauth.github.key,
      //  oauthGitHubActive: outcome.user.github ? !!outcome.user.github.id : false,
      //  oauthFacebook: !!req.app.config.oauth.facebook.key,
      //  oauthFacebookActive: outcome.user.facebook ? !!outcome.user.facebook.id : false,
      //  oauthGoogle: !!req.app.config.oauth.google.key,
      //  oauthGoogleActive: outcome.user.google ? !!outcome.user.google.id : false,
      //  oauthTumblr: !!req.app.config.oauth.tumblr.key,
      //  oauthTumblrActive: outcome.user.tumblr ? !!outcome.user.tumblr.id : false
      //});
    };

    require('async').parallel([getAccountData, getUserData], asyncFinally);
  },
  upsertVerification: function(req, res, next){
    var workflow = req.app.utility.workflow(req, res);

    workflow.on('generateTokenOrSkip', function() {
      if (req.user.roles.account.isVerified === 'yes') {
        workflow.outcome.errors.push('account already verified');
        return workflow.emit('response');
      }
      if (req.user.roles.account.verificationToken !== '') {
        //token generated already
        return workflow.emit('response');
      }

      workflow.emit('generateToken');
    });

    workflow.on('generateToken', function() {
      var crypto = require('crypto');
      crypto.randomBytes(21, function(err, buf) {
        if (err) {
          return next(err);
        }

        var token = buf.toString('hex');
        req.app.db.models.User.encryptPassword(token, function(err, hash) {
          if (err) {
            return next(err);
          }

          workflow.emit('patchAccount', token, hash);
        });
      });
    });

    workflow.on('patchAccount', function(token, hash) {
      var fieldsToSet = { verificationToken: hash };
      req.app.db.models.Account.findByIdAndUpdate(req.user.roles.account.id, fieldsToSet, function(err, account) {
        if (err) {
          return next(err);
        }

        sendVerificationEmail(req, res, {
          email: req.user.email,
          verificationToken: token,
          onSuccess: function() {
            return workflow.emit('response');
          },
          onError: function(err) {
            return next(err);
          }
        });
      });
    });

    workflow.emit('generateTokenOrSkip');
  },
  resendVerification: function(req, res, next){
    var workflow = req.app.utility.workflow(req, res);

    if (req.user.roles.account.isVerified === 'yes') {
      workflow.outcome.errors.push('account already verified');
      return workflow.emit('response');
    }

    workflow.on('validate', function() {
      if (!req.body.email) {
        workflow.outcome.errfor.email = 'required';
      }
      else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(req.body.email)) {
        workflow.outcome.errfor.email = 'invalid email format';
      }

      if (workflow.hasErrors()) {
        return workflow.emit('response');
      }

      workflow.emit('duplicateEmailCheck');
    });

    workflow.on('duplicateEmailCheck', function() {
      req.app.db.models.User.findOne({ email: req.body.email.toLowerCase(), _id: { $ne: req.user.id } }, function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }

        if (user) {
          workflow.outcome.errfor.email = 'email already taken';
          return workflow.emit('response');
        }

        workflow.emit('patchUser');
      });
    });

    workflow.on('patchUser', function() {
      var fieldsToSet = { email: req.body.email.toLowerCase() };
      req.app.db.models.User.findByIdAndUpdate(req.user.id, fieldsToSet, function(err, user) {
        if (err) {
          return workflow.emit('exception', err);
        }

        workflow.user = user;
        workflow.emit('generateToken');
      });
    });

    workflow.on('generateToken', function() {
      var crypto = require('crypto');
      crypto.randomBytes(21, function(err, buf) {
        if (err) {
          return next(err);
        }

        var token = buf.toString('hex');
        req.app.db.models.User.encryptPassword(token, function(err, hash) {
          if (err) {
            return next(err);
          }

          workflow.emit('patchAccount', token, hash);
        });
      });
    });

    workflow.on('patchAccount', function(token, hash) {
      var fieldsToSet = { verificationToken: hash };
      req.app.db.models.Account.findByIdAndUpdate(req.user.roles.account.id, fieldsToSet, function(err, account) {
        if (err) {
          return workflow.emit('exception', err);
        }

        sendVerificationEmail(req, res, {
          email: workflow.user.email,
          verificationToken: token,
          onSuccess: function() {
            workflow.emit('response');
          },
          onError: function(err) {
            workflow.outcome.errors.push('Error Sending: '+ err);
            workflow.emit('response');
          }
        });
      });
    });

    workflow.emit('validate');
  },
  verify: function(req, res, next){
    var outcome = {};
    req.app.db.models.User.validatePassword(req.params.token, req.user.roles.account.verificationToken, function(err, isValid) {
      if (!isValid) {
        outcome.errors = ['invalid verification token'];
        outcome.success = false;
        return res.status(200).json(outcome);
      }

      var fieldsToSet = { isVerified: 'yes', verificationToken: '' };
      req.app.db.models.Account.findByIdAndUpdate(req.user.roles.account._id, fieldsToSet, function(err, account) {
        if (err) {
          return next(err);
        }
        outcome.success = true;
        outcome.user = {
          id: req.user._id,
          email: req.user.email,
          admin: !!(req.user.roles && req.user.roles.admin),
          isVerified: true
        };
        return res.status(200).json(outcome);
      });
    });
  }
};
module.exports = account;
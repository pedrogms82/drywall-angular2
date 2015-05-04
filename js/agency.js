/*!
 * Start Bootstrap - Agency Bootstrap Theme (http://startbootstrap.com)
 * Code licensed under the Apache License v2.0.
 * For details, see http://www.apache.org/licenses/LICENSE-2.0.
 */

// jQuery for page scrolling feature - requires jQuery Easing plugin
$(function() {
    $('a.page-scroll').bind('click', function(event) {
        var $anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 1500, 'easeInOutExpo');
        event.preventDefault();
    });
    var $contactForm = $('#contactForm');
    $contactForm.validate({ // initialize the plugin
        rules: {
            email: {
                required: true,
                email: true
            },
            message: {
                required: true
            }
        },
        submitHandler: function(form) {
            var data = $contactForm.serialize();
            $.ajax({
                type: "POST",
                url: 'http://formspree.io/arthurckao+angular-drywall@gmail.com',
                data: data,
                dataType: 'json',
                success: function () {
                    $contactForm.find('input,textarea').val('');
                    alert('Thank you for your message. We will be in touch soon!');
                },
                error: function(){
                    $contactForm.find('input,textarea').val('');
                }
            });
        }
    });

    //contactForm.find('button').bind('click', function(event){
    //    if (!contactForm.find('input,textarea').jqBootstrapValidation("hasErrors")) {
    //        var data = contactForm.serialize();
    //        $.ajax({
    //            type: "POST",
    //            url: 'http://formspree.io/arthurckao+angular-drywall@gmail.com',
    //            data: data,
    //            dataType: 'json',
    //            success: function(){
    //                contactForm.find('intput,textarea').val('');
    //                alert('Thank you for your message. We will be in touch soon!');
    //            }
    //        });
    //    }
    //    event.preventDefault();
    //});
});

// Highlight the top nav as scrolling occurs
$('body').scrollspy({
    target: '.navbar-fixed-top'
})

// Closes the Responsive Menu on Menu Item Click
$('.navbar-collapse ul li a').click(function() {
    $('.navbar-toggle:visible').click();
});
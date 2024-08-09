module.exports = {
    index: async ctx => {
        await strapi.plugins['email'].services.email.send({
            to: 'jhonsebastianmora@gmail.com',
            from: 'jhonsebastianmora@gmail.com',
            replayto: 'jhonsebastianmora@gmail.com',
            subject: 'testing sendgrid and strapi',
            text: 'Sendgrid email'
        });
        ctx.send('Email sent!')
    }
}
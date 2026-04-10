const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const isGmail = process.env.EMAIL_SERVICE === "gmail";

const transporter = nodemailer.createTransport(
    isGmail
        ? {
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        }
        : {
            host: "smtpout.secureserver.net",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        }
);


const sendEmail = async (to, subject, templateName, data) => {
    try {
        const templatePath = path.join(__dirname, "../templates", templateName);

        let htmlContent = fs.readFileSync(templatePath, "utf8");

        Object.keys(data).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, "g");
            htmlContent = htmlContent.replace(regex, data[key]);
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

module.exports = { sendEmail };

const cron = require("node-cron");
const ProjectCampaign = require("../modules/projects/models/ProjectCampaign");

/**
 * Cron job to automatically expire campaigns that have passed their end date
 * Runs every day at midnight (00:00)
 */
const expireCampaignsJob = cron.schedule("0 0 * * *", async () => {
    try {
        console.log("Running campaign expiration cron job...");

        const now = new Date();

        // Find all active or paused campaigns where endDate has passed
        const result = await ProjectCampaign.updateMany(
            {
                status: { $in: ["active", "paused"] },
                endDate: { $exists: true, $ne: null, $lt: now },
            },
            {
                $set: { status: "expired" },
            }
        );

        console.log(
            `Campaign expiration job completed. ${result.modifiedCount} campaign(s) expired.`
        );
    } catch (error) {
        console.error("Error in campaign expiration cron job:", error);
    }
});

/**
 * Cron job to automatically activate upcoming campaigns when start date is reached
 * Runs every hour
 */
const activateCampaignsJob = cron.schedule("0 * * * *", async () => {
    try {
        console.log("Running campaign activation cron job...");

        const now = new Date();

        // Find all upcoming campaigns where startDate has arrived
        const result = await ProjectCampaign.updateMany(
            {
                status: "upcoming",
                startDate: { $exists: true, $ne: null, $lte: now },
            },
            {
                $set: { status: "active" },
            }
        );

        console.log(
            `Campaign activation job completed. ${result.modifiedCount} campaign(s) activated.`
        );
    } catch (error) {
        console.error("Error in campaign activation cron job:", error);
    }
});


const completeCampaignsJob = cron.schedule("0 * * * *", async () => {
    try {
        console.log("Running campaign completion cron job...");

        // Find all active campaigns where collectedAmount >= targetAmount
        const result = await ProjectCampaign.updateMany(
            {
                status: "active",
                $expr: { $gte: ["$collectedAmount", "$targetAmount"] },
            },
            {
                $set: { status: "completed" },
            }
        );

        console.log(
            `Campaign completion job completed. ${result.modifiedCount} campaign(s) marked as completed.`
        );
    } catch (error) {
        console.error("Error in campaign completion cron job:", error);
    }
});

/**
 * Start all cron jobs
 */
const startCronJobs = () => {
    console.log("Starting cron jobs...");
    expireCampaignsJob.start();
    activateCampaignsJob.start();
    completeCampaignsJob.start();
    console.log("Cron jobs started successfully!");
};

/**
 * Stop all cron jobs
 */
const stopCronJobs = () => {
    console.log("Stopping cron jobs...");
    expireCampaignsJob.stop();
    activateCampaignsJob.stop();
    completeCampaignsJob.stop();
    console.log("Cron jobs stopped.");
};

module.exports = {
    startCronJobs,
    stopCronJobs,
    expireCampaignsJob,
    activateCampaignsJob,
    completeCampaignsJob,
};

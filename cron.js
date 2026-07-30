const cron = require('node-cron');
const { query } = require('./db');

/**
 * Placeholder function to simulate sending WhatsApp / SMS reminders.
 * In production, integrate WhatsApp Cloud API, Twilio, or UltraMsg here.
 */
async function sendWhatsAppReminder(mobileNumber, customerName, vehicleNumber, docType, expiryDate, daysLeft) {
    const formattedMobile = mobileNumber.startsWith('+') ? mobileNumber : `+91-${mobileNumber}`;
    const message = `🚨 *RTO Document Expiry Alert*\n\nDear ${customerName},\nYour vehicle *${vehicleNumber}* document (*${docType.toUpperCase()}*) will expire in *${daysLeft} days* (on ${expiryDate}).\n\nPlease contact us for hassle-free renewal!`;

    console.log(`=======================================================`);
    console.log(`📱 [WHATSAPP REMINDER SENT]`);
    console.log(`   To: ${formattedMobile} (${customerName})`);
    console.log(`   Vehicle: ${vehicleNumber} | Document: ${docType.toUpperCase()}`);
    console.log(`   Expires In: ${daysLeft} days (${expiryDate})`);
    console.log(`   Message Preview:\n${message}`);
    console.log(`=======================================================`);

    return { success: true, mobile: formattedMobile, message };
}

/**
 * Check DB for documents expiring in target days (e.g. 10 days and 2 days)
 */
async function checkAndSendReminders(targetDaysArray = [10, 2]) {
    console.log(`\n⏰ [CRON JOB STARTED] Checking document expiries for ${targetDaysArray.join(' & ')} days ahead...`);
    
    try {
        const vehicles = await query(`
            SELECT 
                v.id, v.vehicle_number, v.vehicle_type,
                v.puc_expiry, v.insurance_expiry, v.fitness_expiry, v.tax_expiry,
                c.name AS customer_name, c.mobile_number
            FROM vehicles v
            JOIN customers c ON v.customer_id = c.id
        `);

        let sentCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const v of vehicles) {
            const docFields = [
                { name: 'PUC', dateStr: v.puc_expiry },
                { name: 'Insurance', dateStr: v.insurance_expiry },
                { name: 'Fitness', dateStr: v.fitness_expiry },
                { name: 'Tax', dateStr: v.tax_expiry }
            ];

            for (const doc of docFields) {
                if (!doc.dateStr) continue;
                
                const expDate = new Date(doc.dateStr);
                expDate.setHours(0, 0, 0, 0);
                
                const diffTime = expDate.getTime() - today.getTime();
                const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

                if (targetDaysArray.includes(diffDays)) {
                    await sendWhatsAppReminder(
                        v.mobile_number,
                        v.customer_name,
                        v.vehicle_number,
                        doc.name,
                        doc.dateStr,
                        diffDays
                    );
                    sentCount++;
                }
            }
        }

        console.log(`✅ [CRON JOB COMPLETED] Total ${sentCount} reminders triggered.\n`);
        return sentCount;
    } catch (err) {
        console.error('❌ Error executing reminder cron job:', err.message);
    }
}

/**
 * Initialize Node-cron Job scheduled daily at 9:00 AM ('0 9 * * *')
 */
function initCronJobs() {
    // Schedule task to run at 09:00 AM every day
    cron.schedule('0 9 * * *', async () => {
        console.log('🌅 Daily 9:00 AM Cron Job Triggered!');
        await checkAndSendReminders([10, 2]);
    });

    console.log('⏰ Daily Reminders Cron Job Scheduled (Runs every day at 9:00 AM)');
}

module.exports = {
    initCronJobs,
    checkAndSendReminders,
    sendWhatsAppReminder
};

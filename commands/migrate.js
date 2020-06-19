const M = require('../api/migration.js');

exports.run = async (client, message, args) => {
    // Picky only command. 
    if (message.author.id !== '296052251234009089') return;
    const admin = client.users.find(u => u.id === '296052251234009089');
    if (message.guild) message.delete().catch(() => console.error);
    return M.migrate(client, admin)
    .then((errors) => admin.send(`Migration complete with ${errors.length} errors `).catch(() => console.error))
    .catch((err) => admin.send(`Fatal error:\n ${err}`).catch(() => console.error));
}
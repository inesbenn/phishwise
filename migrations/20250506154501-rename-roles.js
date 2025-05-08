module.exports = {
  async up(db, client) {
    await db.collection('users').updateMany(
      { role: 'admin' },
      { $set: { role: 'Admin' } }
    );
    await db.collection('users').updateMany(
      { role: 'analyst' },
      { $set: { role: 'Analyste' } }
    );
    await db.collection('users').updateMany(
      { role: 'viewer' },
      { $set: { role: 'Cible' } }
    );
  },

  async down(db, client) {
    // Optionnel : rollback
    await db.collection('users').updateMany(
      { role: 'Admin' },
      { $set: { role: 'admin' } }
    );
    await db.collection('users').updateMany(
      { role: 'Analyste' },
      { $set: { role: 'analyst' } }
    );
    await db.collection('users').updateMany(
      { role: 'Cible' },
      { $set: { role: 'viewer' } }
    );
  }
};

import { boolean, date, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const members = pgTable(
  'members',
  {
    discordId: varchar('discord_id', { length: 18 }).primaryKey(),
    birthday: date('birthday', { mode: 'date' }),
    hasBirthYear: boolean('has_birth_year').notNull()
  },
  (members) => {
    return {
      discordIdIndex: uniqueIndex('discord_id_idx').on(members.discordId)
    };
  }
);

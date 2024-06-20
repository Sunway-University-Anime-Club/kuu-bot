import { boolean, date, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const discordMembers = pgTable(
  'discord_members',
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

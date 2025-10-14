import { boolean, date, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const discordMembers = pgTable(
  'discord_members',
  {
    discordId: text('discord_id').primaryKey(),
    birthday: date('birthday', { mode: 'date' }),
    hasBirthYear: boolean('has_birth_year').notNull()
  },
  (members) => {
    return {
      discordIdIndex: uniqueIndex('discord_id_idx').on(members.discordId)
    };
  }
);

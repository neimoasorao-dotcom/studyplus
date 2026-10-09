import {integer,sqliteTable,text,primaryKey} from 'drizzle-orm/sqlite-core';
export const state=sqliteTable('dashboard_state',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0)});
export const chunks=sqliteTable('dashboard_chunks',{revision:integer('revision').notNull(),part:integer('part').notNull(),body:text('body').notNull()},t=>[primaryKey({columns:[t.revision,t.part]})]);

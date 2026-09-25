import { relations } from "drizzle-orm";

import { account, invitation, session, user } from "./auth";
import { media, posts, postTags, tags } from "./content";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  posts: many(posts),
  media: many(media),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const postRelations = relations(posts, ({ one, many }) => ({
  author: one(user, { fields: [posts.authorId], references: [user.id] }),
  coverImage: one(media, {
    fields: [posts.coverImageId],
    references: [media.id],
  }),
  postTags: many(postTags),
}));

export const tagRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postTagRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  uploadedBy: one(user, {
    fields: [media.uploadedById],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  invitedBy: one(user, {
    fields: [invitation.invitedById],
    references: [user.id],
  }),
}));

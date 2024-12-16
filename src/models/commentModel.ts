import { t } from 'elysia';
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    imageUrl: String,
    blog: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    votes: Number,
    likes: Number,
    replies: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        content: String,
        votes: Number,
        likes: Number,
      },
    ],
  },
  {
    timestamps: true,
  },
);
commentSchema.index({ createdAt: 1 });
const Comment = model('Comment', commentSchema);
export default Comment;

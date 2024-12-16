import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const likeSchema = new Schema(
  {
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
    liked: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

likeSchema.index({ blog: 1, user: 1 }, { unique: true });
likeSchema.index({ createdAt: 1 });
likeSchema.index({ user: 1, blog: 1 });

const Like = model('Like', likeSchema);
export default Like;

import { Elysia, t } from 'elysia';
import Blog from '../models/blogModel';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import { convertBase64ToImage } from '../utils/convertBase64ToImage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import fs from 'fs';
import mongoose from 'mongoose';
import Like from '../models/likeModel';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class BlogController {}

export const blog = new Elysia()
  .decorate('blogController', new BlogController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .group('/api/blogs', (app) =>
    app
      .get(
        '/:blogId',
        async ({ error, jwt, cookie: { auth }, params }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            // const token = await jwt.verify(auth.value);
            // if (!token) {
            //   return error(401, 'Unauthorized');
            // }

            const blog = await Blog.findById(params.blogId)
              .populate(
                'author',
                'username name email imageUrl createdAt bio personalWebsite _id',
              )
              .populate({
                path: 'comments',
                select:
                  'content imageUrl user votes likes replies createdAt updatedAt _id',
                populate: {
                  path: 'user',
                  select:
                    'username name email imageUrl createdAt bio personalWebsite _id',
                },
              })
              .populate({
                path: 'likes',
                select: 'liked user blog _id createdAt updatedAt',
                populate: {
                  path: 'user',
                  select:
                    'username name email imageUrl createdAt bio personalWebsite _id',
                },
              })
              .exec();

            if (!blog) {
              return error(404, 'Blog not found');
            }

            return blog.toJSON();
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .get('/', async ({ error }) => {
        try {
          const blogs = await Blog.find()
            .sort({ createdAt: -1 })
            .populate(
              'author',
              'email name username imageUrl createdAt bio personalWebsite _id',
            )
            .exec();

          if (!blogs || blogs.length === 0) {
            return error(404, 'Blogs not found');
          }

          return blogs;
        } catch (err) {
          console.log(err);
          return error(500, "Something's wrong");
        }
      })
      .post(
        '/',
        async ({ body, jwt, error, cookie: { auth } }) => {
          try {
            const { title, tags, content, published } = body;
            if (!title || !content) {
              return error(400, 'Missing title, author or content');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const user = await User.findById(identity.id);
            if (!user) {
              return error(404, 'User not found');
            }

            const contentParsed = JSON.parse(content);

            const base64Images: any[] = [];

            contentParsed.ops.forEach((op: any) => {
              if (
                op.insert &&
                op.insert.image &&
                op.insert.image.startsWith('data:image')
              ) {
                base64Images.push(op.insert.image);
              }
            });

            const outputFilePaths: string[] = [];

            if (base64Images.length !== 0) {
              base64Images.forEach((base64Image, index) => {
                const outputFilePath = `${process.cwd()}/temp/${
                  user._id
                }-${Date.now()}-${uuidv4()}.png`;
                convertBase64ToImage(base64Image, outputFilePath);
                outputFilePaths.push(outputFilePath);
              });
            }

            const cloudinaryPromises = outputFilePaths.map((outputFilePath) => {
              return cloudinary.v2.uploader.upload(outputFilePath, {
                folder: 'blogs',
                use_filename: true,
              });
            });

            const cloudinaryResults = await Promise.all(cloudinaryPromises);

            if (!cloudinaryResults) {
              return error(500, "Can't upload images to cloudinary");
            }

            outputFilePaths.forEach((outputFilePath) =>
              fs.unlinkSync(outputFilePath),
            );

            const imageUrls = cloudinaryResults.map(
              (result) => result.secure_url,
            );

            contentParsed.ops.forEach((op: any) => {
              if (
                op.insert &&
                op.insert.image &&
                op.insert.image.startsWith('data:image')
              ) {
                const index = base64Images.indexOf(op.insert.image);
                if (index !== -1) {
                  op.insert.image = imageUrls[index];
                }
              }
            });

            const blog = await Blog.create({
              author: user._id,
              title,
              content: JSON.stringify(contentParsed),
              tags,
              slug: title.toLowerCase().replace(/ /g, '-'),
              published,
            });

            if (!blog) {
              return error(500, "Can't create blog");
            }

            return {
              base64Images,
              outputFilePaths,
              imageUrls,
              contentParsed,
              blog,
            };

            // const blog = await Blog.create({
            //   author: user._id,
            //   title,
            //   content,
            //   tags,
            //   slug: title.toLowerCase().replace(/ /g, '-'),
            //   published,
            // });

            // if (!blog) {
            //   return error(500, "Can't create blog");
            // }

            // return {
            //   status: 'success',
            //   blog,
            // };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          body: t.Object({
            title: t.String(),
            tags: t.Optional(t.Array(t.String())),
            content: t.String(),
            published: t.Boolean(),
          }),
        },
      )
      .delete(
        '/:blogId',
        async ({ error, jwt, params, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndDelete(params.blogId);

            if (!blog) {
              return error(404, 'Blog not found');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .put(
        '/:blogId',
        async ({ error, jwt, params, body, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }
            if (!body) {
              return error(400, 'Missing body');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndUpdate(
              params.blogId,
              {
                author: body.author,
                title: body.title,
                content: body.content,
                slug: body.title.toLowerCase().replace(/ /g, '-'),
              },
              {
                new: true,
              },
            );

            if (!blog) {
              return error(404, 'Update failed');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
          body: t.Object({
            title: t.String(),
            author: t.String(),
            content: t.String(),
          }),
        },
      )
      .post(
        '/like/:blogId',
        async ({ error, jwt, params, cookie: { auth } }) => {
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            const { blogId } = params;

            if (!blogId) {
              return error(400, 'Missing blogId');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            // const [user, blog] = await Promise.all([
            //   User.findById(identity.id).session(session),
            //   Blog.findById(blogId).session(session),
            // ]);

            const user = await User.findById(identity.id).session(session);
            const blog = await Blog.findById(blogId).session(session);

            if (!user || !blog) {
              await session.abortTransaction();
              return error(404, 'User or blog not found');
            }

            const like = await Like.findOne({
              blog: blogId,
              user: user._id,
            });

            if (like) {
              await session.abortTransaction();
              return error(400, 'You already liked this blog');
            }

            const newLike = new Like({
              blog: blogId,
              user: user._id,
              liked: true,
            });

            await newLike.save({ session });

            blog.likes.push(newLike._id);
            await blog.save({ session });

            await session.commitTransaction();

            return {
              status: 'success',
              like: newLike,
            };
          } catch (err) {
            await session.abortTransaction();
            console.log(err);
            return error(500, "Something's wrong");
          } finally {
            session.endSession();
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .post(
        '/unlike/:blogId',
        async ({ error, jwt, params, cookie: { auth } }) => {
          const session = await mongoose.startSession();

          try {
            session.startTransaction();

            const { blogId } = params;

            if (!blogId) {
              await session.abortTransaction();
              return error(400, 'Missing blogId');
            }

            const identity = await jwt.verify(auth.value);
            if (!identity) {
              await session.abortTransaction();
              return error(401, 'Unauthorized');
            }

            // Truy vấn đồng thời
            const [user, blog] = await Promise.all([
              User.findById(identity.id).session(session),
              Blog.findById(blogId).session(session),
            ]);

            if (!user) {
              await session.abortTransaction();
              return error(404, 'User not found');
            }

            if (!blog) {
              await session.abortTransaction();
              return error(404, 'Blog not found');
            }

            const like = await Like.findOne({
              blog: blogId,
              user: user._id,
            }).session(session);

            if (!like) {
              await session.abortTransaction();
              return error(400, 'You have not liked this blog');
            }

            const deletedLike = await Like.findByIdAndDelete(like._id).session(
              session,
            );
            if (!deletedLike) {
              await session.abortTransaction();
              return error(500, 'Failed to remove like');
            }

            const updateBlog = await Blog.findByIdAndUpdate(blogId, {
              $pull: { likes: deletedLike._id },
            }).session(session);

            if (!updateBlog) {
              await session.abortTransaction();
              return error(500, 'Failed to update blog');
            }

            await session.commitTransaction();

            return {
              status: 'success',
              like: deletedLike,
            };
          } catch (err) {
            console.log(err);
            await session.abortTransaction();
            return error(500, "Something's wrong");
          } finally {
            session.endSession();
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .get(
        '/tags',
        async ({ error, jwt, cookie: { auth }, query }) => {
          try {
            const { tags } = query;

            if (!tags) {
              return error(400, 'Missing tags');
            }

            const blogs = await Blog.find({
              tags: { $in: tags },
            })
              .select('title _id')
              // .populate(
              //   'author',
              //   'email name username imageUrl createdAt bio personalWebsite _id',
              // )
              .exec();
            if (!blogs || blogs.length === 0) {
              return error(404, 'Blogs not found');
            }
            return blogs;
          } catch (err) {
            return error(500, "Something's wrong");
          }
        },
        {
          query: t.Object({ tags: t.Optional(t.Array(t.String())) }),
        },
      ),
  );

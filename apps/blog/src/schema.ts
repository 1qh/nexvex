import { owned } from '@a/be/t'

const createBlog = owned.blog.omit({ published: true }),
  editBlog = owned.blog.partial()

export { createBlog, editBlog }

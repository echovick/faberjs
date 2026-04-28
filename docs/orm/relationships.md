# Relationships

FaberJS ORM supports four relationship types: `hasMany`, `hasOne`, `belongsTo`, and `belongsToMany`. Relationships are defined as instance methods on the model and can be eagerly loaded.

## `hasMany`

A user has many posts. The `posts` table has a `user_id` foreign key.

```typescript
import { Model } from '@faber-js/orm';
import type { HasMany } from '@faber-js/orm';
import { Post } from './Post';

export class User extends Model {
  static override table = 'users';
  static override fillable: readonly string[] = ['name', 'email'];

  posts(): HasMany<this, Post> {
    return this.hasMany(Post);
    // By convention, foreignKey is inferred as 'user_id'
    // localKey defaults to 'id'
  }
}
```

To override the inferred foreign key:

```typescript
posts(): HasMany<this, Post> {
  return this.hasMany(Post, 'author_id', 'id');
}
```

### Fetching related records

```typescript
const user = await User.findOrFail<User>(1);
const posts = await user.posts().get();
```

## `hasOne`

A user has one profile.

```typescript
import { Profile } from './Profile';

export class User extends Model {
  static override table = 'users';

  profile(): HasOne<this, Profile> {
    return this.hasOne(Profile);
    // Inferred foreignKey: 'user_id'
  }
}
```

```typescript
const user = await User.findOrFail<User>(1);
const profile = await user.profile().get(); // Profile | null
```

## `belongsTo`

A post belongs to a user.

```typescript
import { User } from './User';

export class Post extends Model {
  static override table = 'posts';
  static override fillable: readonly string[] = ['title', 'body', 'user_id'];

  user(): BelongsTo<this, User> {
    return this.belongsTo(User);
    // Inferred foreignKey on this model: 'user_id'
    // ownerKey on User: 'id'
  }
}
```

```typescript
const post = await Post.findOrFail<Post>(1);
const author = await post.user().get(); // User | null
```

## `belongsToMany`

A post belongs to many tags via a `post_tag` pivot table.

```typescript
import { Tag } from './Tag';

export class Post extends Model {
  static override table = 'posts';

  tags(): BelongsToMany<this, Tag> {
    return this.belongsToMany(Tag, 'post_tag');
    // Inferred foreignPivotKey: 'post_id'
    // Inferred relatedPivotKey: 'tag_id'
  }
}
```

Override the pivot keys:

```typescript
tags(): BelongsToMany<this, Tag> {
  return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');
}
```

```typescript
const post = await Post.findOrFail<Post>(1);
const tags = await post.tags().get(); // Tag[]
```

### Pivot table manipulation

`BelongsToMany` provides `attach()`, `detach()`, and `sync()` for managing pivot rows directly.

```typescript
const post = await Post.findOrFail<Post>(1);

// Add tags without removing existing ones
await post.tags().attach([1, 2, 3]);

// Attach with extra pivot data
await post.tags().attach([4], { featured: true });

// Remove specific tags
await post.tags().detach([2]);

// Remove all tags
await post.tags().detach();

// Replace all tags — only tags 1 and 3 remain
await post.tags().sync([1, 3]);

// Sync without detaching extras (only add missing ones)
await post.tags().sync([5], false);
```

## Eager loading

Load relationships without N+1 queries using `.with()` on the query builder. Eager loading fires one additional query per relationship.

```typescript
const posts = await Post.with<Post>('user', 'tags').orderBy('created_at', 'desc').get();
```

Access the loaded relation with `getRelation()`:

```typescript
for (const post of posts) {
  const author = post.getRelation<User>('users');
  const tags = post.getRelation<Tag[]>('tags');
}
```

::: tip Relation key convention
`getRelation()` uses the related model's `table` name as the key (e.g. `'users'` for the `User` model, `'tags'` for `Tag`). This matches what the eager-loader stores internally.
:::

## Full example

```typescript
// app/models/User.ts
import { Model } from '@faber-js/orm';
import type { HasMany, HasOne } from '@faber-js/orm';

export class User extends Model {
  static override table = 'users';
  static override fillable: readonly string[] = ['name', 'email', 'password'];
  static override hidden: readonly string[] = ['password'];

  posts(): HasMany<this, Post> {
    return this.hasMany(Post);
  }

  profile(): HasOne<this, Profile> {
    return this.hasOne(Profile);
  }
}

// app/models/Post.ts
import { Model } from '@faber-js/orm';
import type { BelongsTo, BelongsToMany } from '@faber-js/orm';

export class Post extends Model {
  static override table = 'posts';
  static override fillable: readonly string[] = ['title', 'body', 'user_id'];
  static override softDeletes = true;

  user(): BelongsTo<this, User> {
    return this.belongsTo(User);
  }

  tags(): BelongsToMany<this, Tag> {
    return this.belongsToMany(Tag, 'post_tag');
  }
}
```

```typescript
// Usage in a service
const users = await User.with<User>('posts').get();

for (const user of users) {
  const posts = user.getRelation<Post[]>('posts');
  console.log(`${user.getAttribute('name')} has ${posts?.length} posts`);
}
```

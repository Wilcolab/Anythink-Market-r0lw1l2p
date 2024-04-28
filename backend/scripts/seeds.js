//TODO: seeds script should come here, so we'll be able to put some data in our local env
var mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
var User = require("./backend/models/User"); // Importa el modelo de usuario
var Item = require("./backend/backend/models/Item"); // Importa el modelo de producto
var Comment = require("./backend/models/Comment"); // Importa el modelo de comentario
/backend/models/User.js
// Establece la conexión a la base de datos
mongoose.connect("mongodb://localhost/anythink-market", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function cleanDatabase() {
  try {
    // Eliminar todos los documentos de las colecciones relevantes
    await User.deleteMany({});
    await Item.deleteMany({});
    await Comment.deleteMany({});
    console.log("Base de datos limpia con éxito.");
  } catch (error) {
    console.error("Error al limpiar la base de datos:", error);
  }
}

// Llama a la función cleanDatabase antes de sembrar la base de datos
async function seedAndClean() {
  await cleanDatabase();
  await seedDatabase();
}

seedAndClean();

// Modelo de usuario
var UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      lowercase: true,
      unique: true,
      required: [true, "can't be blank"],
      match: [/^[a-zA-Z0-9]+$/, "is invalid"],
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      unique: true,
      required: [true, "can't be blank"],
      match: [/\S+@\S+\.\S+/, "is invalid"],
      index: true,
    },
    bio: String,
    image: String,
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    hash: String,
    salt: String,
  },
  { timestamps: true }
);

UserSchema.plugin(uniqueValidator, { message: "is already taken" });

UserSchema.methods.validPassword = function (password) {
  var hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
  return this.hash === hash;
};

UserSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 10000, 512, "sha512")
    .toString("hex");
};

UserSchema.methods.generateJWT = function () {
  var today = new Date();
  var exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      exp: parseInt(exp.getTime() / 1000),
    },
    secret
  );
};

UserSchema.methods.toAuthJSON = function () {
  return {
    username: this.username,
    email: this.email,
    token: this.generateJWT(),
    bio: this.bio,
    image: this.image,
    role: this.role,
  };
};

UserSchema.methods.toProfileJSONFor = function (user) {
  return {
    username: this.username,
    bio: this.bio,
    image:
      this.image || "https://static.productionready.io/images/smiley-cyrus.jpg",
    following: user ? user.isFollowing(this._id) : false,
  };
};

UserSchema.methods.favorite = function (id) {
  if (this.favorites.indexOf(id) === -1) {
    this.favorites = this.favorites.concat([id]);
  }

  return this.save();
};

UserSchema.methods.unfavorite = function (id) {
  this.favorites.remove(id);
  return this.save();
};

UserSchema.methods.isFavorite = function (id) {
  return this.favorites.some(function (favoriteId) {
    return favoriteId.toString() === id.toString();
  });
};

UserSchema.methods.follow = function (id) {
  if (this.following.indexOf(id) === -1) {
    this.following = this.following.concat([id]);
  }

  return this.save();
};

UserSchema.methods.unfollow = function (id) {
  this.following.remove(id);
  return this.save();
};

UserSchema.methods.isFollowing = function (id) {
  return this.following.some(function (followId) {
    return followId.toString() === id.toString();
  });
};

mongoose.model("User", UserSchema);

// Modelo de producto
var ItemSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: { type: String, required: [true, "can't be blank"] },
    description: { type: String, required: [true, "can't be blank"] },
    image: String,
    favoritesCount: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    tagList: [{ type: String }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ItemSchema.plugin(uniqueValidator, { message: "is already taken" });

ItemSchema.pre("validate", function (next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

ItemSchema.methods.slugify = function () {
  this.slug =
    slug(this.title) +
    "-" +
    ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

ItemSchema.methods.updateFavoriteCount = function () {
  var item = this;

  return User.count({ favorites: { $in: [item._id] } }).then(function (count) {
    item.favoritesCount = count;

    return item.save();
  });
};

ItemSchema.methods.toJSONFor = function (user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    image: this.image,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tagList: this.tagList,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    seller: this.seller.toProfileJSONFor(user),
  };
};

mongoose.model("Item", ItemSchema);

// Modelo de comentario
var CommentSchema = new mongoose.Schema(
  {
    body: String,
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  },
  { timestamps: true }
);

// Requires population of seller
CommentSchema.methods.toJSONFor = function (user) {
  return {
    id: this._id,
    body: this.body,
    createdAt: this.createdAt,
    seller: this.seller.toProfileJSONFor(user),
  };
};

mongoose.model("Comment", CommentSchema);

// Sembrar la base de datos con datos aleatorios
var User = mongoose.model("User");
var Item = mongoose.model("Item");
var Comment = mongoose.model("Comment");

async function seedDatabase() {
  try {
    // Sembrar usuarios
    var users = [];
    for (var i = 0; i < 100; i++) {
      var userData = {
        username: "user" + i,
        email: "user" + i + "@example.com",
        bio: "User " + i + " bio",
        image: "https://example.com/image.png",
        role: "user",
      };
      var user = new User(userData);
      await user.setPassword("password"); // Definir contraseña para todos los usuarios
      await user.save();
      users.push(user);
    }

    // Sembrar productos
    var products = [];
    for (var i = 0; i < 100; i++) {
      var productData = {
        title: "Product " + i,
        description: "Description of product " + i,
        image: "https://example.com/image.png",
        tagList: ["tag1", "tag2"],
        seller: users[i % 100]._id, // Asignar vendedor de manera circular
      };
      var product = new Item(productData);
      await product.save();
      products.push(product);
    }

    // Sembrar comentarios
    var comments = [];
    for (var i = 0; i < 100; i++) {
      var commentData = {
        body: "Comment " + i,
        seller: users[i % 100]._id, // Asignar vendedor de manera circular
        item: products[i % 100]._id, // Asignar producto de manera circular
      };
      var comment = new Comment(commentData);
      await comment.save();
      comments.push(comment);
    }

    console.log("Base de datos sembrada con éxito.");
  } catch (error) {
    console.error("Error al sembrar la base de datos:", error);
  } finally {
    mongoose.disconnect();
  }
}

seedDatabase();

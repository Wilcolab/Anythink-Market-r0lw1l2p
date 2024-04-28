//TODO: seeds script should come here, so we'll be able to put some data in our local env
var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var User = require('../models/User'); // Importa el modelo de usuario
var Item = require('../models/Item'); // Importa el modelo de producto
var Comment = require('../models/Comment'); // Importa el modelo de comentario
require('../models/User');

// Establece la conexión a la base de datos
mongoose.connect('mongodb://localhost/anythink-market', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Modelo de producto
var ItemSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: { type: String, required: [true, "can't be blank"] },
    description: { type: String, required: [true, "can't be blank"] },
    image: String,
    favoritesCount: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    tagList: [{ type: String }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ItemSchema.plugin(uniqueValidator, { message: 'is already taken' });

ItemSchema.pre('validate', function (next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

ItemSchema.methods.slugify = function () {
  this.slug =
    slug(this.title) +
    '-' +
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

mongoose.model('Item', ItemSchema);

// Modelo de comentario
var CommentSchema = new mongoose.Schema(
  {
    body: String,
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
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

mongoose.model('Comment', CommentSchema);

// Sembrar la base de datos con datos aleatorios
var User = mongoose.model('User');
var Item = mongoose.model('Item');
var Comment = mongoose.model('Comment');

async function seedDatabase() {
  try {
    // Sembrar usuarios
    var users = [];
    for (var i = 0; i < 100; i++) {
      var userData = {
        username: 'user' + i,
        email: 'user' + i + '@example.com',
        bio: 'User ' + i + ' bio',
        image: 'https://example.com/image.png',
        role: 'user',
      };
      var user = new User(userData);
      await user.setPassword('password'); // Definir contraseña para todos los usuarios
      await user.save();
      users.push(user);
    }

    // Sembrar productos
    var products = [];
    for (var i = 0; i < 100; i++) {
      var productData = {
        title: 'Product ' + i,
        description: 'Description of product ' + i,
        image: 'https://example.com/image.png',
        tagList: ['tag1', 'tag2'],
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
        body: 'Comment ' + i,
        seller: users[i % 100]._id, // Asignar vendedor de manera circular
        item: products[i % 100]._id, // Asignar producto de manera circular
      };
      var comment = new Comment(commentData);
      await comment.save();
      comments.push(comment);
    }

    console.log('Base de datos sembrada con éxito.');
  } catch (error) {
    console.error('Error al sembrar la base de datos:', error);
  } finally {
    mongoose.disconnect();
  }
}


seedDatabase();

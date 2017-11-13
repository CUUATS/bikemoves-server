const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const webpack = require('webpack');
const inProduction = process.env.BIKEMOVES_DEBUG !== 'true';

function getPlugins() {
  let plugins = [
    new ExtractTextPlugin('explore.css')
  ];

  if (inProduction)
    plugins.push(new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }));

  return plugins;
}

module.exports = {
  entry: './src/explore/public/index.js',
  output: {
    filename: 'explore.js',
    path: path.resolve(__dirname, 'dist', 'explore'),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader'
        })
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'images/[name].[ext]',
              context: ''
            }
          }
        ]
      },
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['babel-preset-env'],
            plugins: ['transform-runtime']
          }
        }
      }
    ]
  },
  plugins: getPlugins(),
  watch: !inProduction
};

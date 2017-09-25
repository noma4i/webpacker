/* eslint global-require: 0 */
/* eslint import/no-dynamic-require: 0 */

const { basename, dirname, join, relative, resolve } = require('path')
const { sync } = require('glob')
const extname = require('path-complete-extname')

const webpack = require('webpack')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const ManifestPlugin = require('webpack-manifest-plugin')

const config = require('./config')
const assetHost = require('./asset_host')

const getLoaderMap = () => {
  const result = new Map()
  const paths = sync(resolve(__dirname, 'loaders', '*.js'))
  paths.forEach((path) => {
    const name = basename(path, extname(path))
    result.set(name, require(path))
  })
  return result
}

const getPluginMap = () => {
  const result = new Map()
  result.set('Environment', new webpack.EnvironmentPlugin(JSON.parse(JSON.stringify(process.env))))
  result.set('ExtractText', new ExtractTextPlugin('[name]-[contenthash].css'))
  result.set('Manifest', new ManifestPlugin({ publicPath: assetHost.publicPath, writeToFileEmit: true }))
  return result
}

const getExtensionsGlob = () => {
  const { extensions } = config
  if (!extensions.length) {
    throw new Error('You must configure at least one extension to compile in webpacker.yml')
  }
  return extensions.length === 1 ? `**/${extensions[0]}` : `**/*{${extensions.join(',')}}`
}

const getEntryMap = () => {
  const result = new Map()
  const glob = getExtensionsGlob()
  const rootPath = join(config.source_path, config.source_entry_path)
  const paths = sync(join(rootPath, glob))
  paths.forEach((path) => {
    const namespace = relative(join(rootPath), dirname(path))
    const name = join(namespace, basename(path, extname(path)))
    result.set(name, resolve(path))
  })
  return result
}

const getResolvedModuleMap = () => {
  const result = new Map()
  result.set('source', resolve(config.source_path))
  result.set('node_modules', 'node_modules')
  if (config.resolved_paths) {
    config.resolved_paths.forEach(path =>
      result.set(path, path)
    )
  }
  return result
}

const getObjectFromMap = ((map) => {
  const obj = {}
  map.forEach((v, k) => (obj[k] = v))
  return obj
})

module.exports = class Environment {
  constructor() {
    this.loaders = getLoaderMap()
    this.plugins = getPluginMap()
    this.entries = getEntryMap()
    this.resolvedModules = getResolvedModuleMap()
    this.config = {
      entry: getObjectFromMap(this.entries),

      output: {
        filename: '[name]-[chunkhash].js',
        chunkFilename: '[name]-[chunkhash].chunk.js',
        path: assetHost.path,
        publicPath: assetHost.publicPath
      },

      module: {
        rules: Array.from(this.loaders.values())
      },

      plugins: Array.from(this.plugins.values()),

      resolve: {
        extensions: config.extensions,
        modules: Array.from(this.resolvedModules.values())
      },

      resolveLoader: {
        modules: ['node_modules']
      }
    }
  }

  toWebpackConfig() {
    return this.config
  }
}

import {
  getBuildTarget,
  getDestinationFromConfig,
  getPackageConfig,
} from 'clio-manifest'

import { build } from './build.js'
import { error } from '../lib/colors.js'
import { getPlatform } from '../lib/platforms.js'
import { join } from 'path'

export const command = 'dev [project]'

export const describe = 'Compile and watch Clio file'

export const builder = {
  project: {
    describe: 'Project root directory, where your clio.toml file is.',
    type: 'string',
    default: '.',
  },
  silent: {
    describe: 'Mutes messages from the command.',
    type: 'boolean',
  },
  clean: {
    describe: 'Wipe the build directory before build',
    type: 'boolean',
  },
}

export function handler(argv) {
  dev(argv, argv._.slice(1))
}

export async function dev(argv, args, forkOptions = {}) {
  try {
    const configPath = join(argv.project, 'clio.toml')

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
      watch: true,
    })

    const config = getPackageConfig(configPath)
    const target = getBuildTarget(configPath, config)
    const destination = getDestinationFromConfig(configPath, config)
    const platform = getPlatform(target)

    return await platform.dev(destination, args, forkOptions)
  } catch (e) {
    error(e)
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  dev,
}

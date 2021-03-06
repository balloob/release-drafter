const getConfig = require('probot-config')
const { isTriggerableBranch } = require('./lib/triggerable-branch')
const { findReleases, generateReleaseBody } = require('./lib/releases')
const { findCommits, findPullRequests } = require('./lib/commits')

const configName = 'release-drafter.yml'

module.exports = app => {
  app.on('push', async context => {
    const config = await getConfig(context, configName) || {}
    const branch = context.payload.ref.replace(/^refs\/heads\//, '')

    if (!config.template) {
      app.log(`No valid config found`)
      return
    }

    if (!isTriggerableBranch({ branch, app, context, config })) {
      return
    }

    const { draftRelease, lastRelease } = await findReleases({ context })
    const commits = await findCommits({ context, branch, lastRelease })
    const mergedPullRequests = await findPullRequests({ context, commits })
    const body = generateReleaseBody({ config, lastRelease, mergedPullRequests })

    if (!draftRelease) {
      app.log(`Creating new draft release`)
      await context.github.repos.createRelease(context.repo({
        tag_name: '',
        body: body,
        draft: true
      }))
    } else {
      app.log(`Updating existing draft release`)
      await context.github.repos.editRelease(context.repo({
        release_id: draftRelease.id,
        body: body
      }))
    }
  })
}

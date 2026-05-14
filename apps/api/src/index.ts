import { buildApp } from './app.js'

buildApp()
  .then((app) => app.listen({ port: 3001, host: '0.0.0.0' }))
  .catch((err: Error) => {
    console.error(err)
    process.exit(1)
  })

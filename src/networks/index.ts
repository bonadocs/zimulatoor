import { patchFetch } from './patches/fetch'

patchFetch()

export { isMappedUrl, getMappedUrl } from './patches/util'
export { networks } from './patches/urls'

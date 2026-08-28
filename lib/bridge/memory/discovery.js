async function isCompatible(provider) {
  if (!provider || typeof provider.capabilities !== 'function') return false
  try {
    const capabilities = await provider.capabilities()
    return capabilities?.read === true && capabilities?.write === true && capabilities?.search === true
  } catch (error) {
    return false
  }
}

export async function selectMemoryProvider({ preferredId = '', sourceProviderId = '', providers = [], fallback }) {
  const candidates = Array.isArray(providers) ? providers : []
  async function matching(id) {
    if (!id) return null
    const provider = candidates.find((candidate) => candidate?.id === id)
    return provider && await isCompatible(provider) ? provider : null
  }
  const preferred = await matching(preferredId)
  if (preferred) return preferred
  const source = await matching(sourceProviderId)
  if (source) return source
  for (const provider of candidates) {
    if (await isCompatible(provider)) return provider
  }
  if (await isCompatible(fallback)) return fallback
  throw new Error('MEMORY_PROVIDER_UNAVAILABLE')
}

export async function discoverMemoryProviders(registrations = [], factories = []) {
  const providers = []
  for (const registration of registrations) {
    for (const factory of factories) {
      const provider = await factory(registration)
      if (provider) { providers.push(provider); break }
    }
  }
  return providers
}

/**
 * Deeply injects environment variables into a configuration object/string/json
 *
 * Uses VSCode env:name pattern: https://code.visualstudio.com/docs/reference/variables-reference#_environment-variables
 *
 * Does not mutate original object
 */
export async function injectEnv<C extends string | Record<PropertyKey, any>>(config: C, notFoundValue: any = "") {
	// Use simple regex replace for now, will see if object traversal and recursion is needed here (e.g: for non-serializable objects)

	const isObject = typeof config === "object"
	let _config: string = isObject ? JSON.stringify(config) : config

	_config = _config.replace(/\$\{env:([\w]+)\}/g, (_, name) => {
		// 移动端兼容性检查
		const envValue = (typeof process !== 'undefined' && process.env) ? process.env[name] : undefined
		
		// Check if null or undefined
		// intentionally using == to match null | undefined
		if (envValue == null) {
			console.warn(`[injectEnv] env variable ${name} referenced but not found in process.env`)
		}

		return envValue ?? notFoundValue
	})

	return (isObject ? JSON.parse(_config) : _config) as C extends string ? string : C
}

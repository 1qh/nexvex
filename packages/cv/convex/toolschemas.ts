import { v } from 'convex/values'
import { object, string, enum as zenum } from 'zod/v4'

const weatherArgsSchema = object({
    city: string().min(1),
    unit: zenum(['celsius', 'fahrenheit']).default('celsius')
  }),
  weatherArgsValidator = v.object({
    city: v.string(),
    unit: v.union(v.literal('celsius'), v.literal('fahrenheit'))
  }),
  parseWeatherArgs = (args: unknown) => {
    const result = weatherArgsSchema.safeParse(args)
    if (!result.success) return null
    return result.data
  }

interface WeatherArgs {
  city: string
  unit: 'celsius' | 'fahrenheit'
}

export { parseWeatherArgs, weatherArgsSchema, weatherArgsValidator }

export type { WeatherArgs }

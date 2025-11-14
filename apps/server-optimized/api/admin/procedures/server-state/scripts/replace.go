package scripts

const ReplaceScript = `
local key = KEYS[1]
local counter_key = KEYS[2]
local new_value = ARGV[1]

redis.call('SET', key, new_value)

local update_count = redis.call('INCR', counter_key)

return update_count
`
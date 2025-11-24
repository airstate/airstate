package scripts

const RemoveScript = `
local key = KEYS[1]
local counter_key = KEYS[2]

redis.call('DEL', key)

local update_count = redis.call('INCR', counter_key)

return update_count
`
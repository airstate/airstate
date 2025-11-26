package kv_scripts

const DeepMergeScript = `
local key = KEYS[1]
local counter_key = KEYS[2]
local new_value_str = ARGV[1]

local current_value = redis.call('GET', key)

if not current_value or current_value == "" then
    redis.call('SET', key, new_value_str)
    local update_count = redis.call('INCR', counter_key)
    return {update_count,new_value_str}
end

local success, current_obj = pcall(cjson.decode, current_value)
local new_success, new_obj = pcall(cjson.decode, new_value_str)

if not success or not new_success or type(current_obj) ~= 'table' or type(new_obj) ~= 'table' then
    redis.call('SET', key, new_value_str)
    local update_count = redis.call('INCR', counter_key)
    return {update_count,new_value_str}
end

local function deep_merge(target, source)
    for k, v in pairs(source) do
        if type(v) == 'table' and type(target[k]) == 'table' then
            deep_merge(target[k], v)
        else
            target[k] = v
        end
    end
    return target
end

local merged = deep_merge(current_obj, new_obj)

local merged_str = cjson.encode(merged)

redis.call('SET', key, merged_str)

local update_count = redis.call('INCR', counter_key)

return {update_count, merged_str }
`

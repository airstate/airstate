package scripts

const AtomicOpsScript = `

local key = KEYS[1]
local counter_key = KEYS[2]
local operations_str = ARGV[1]

local success, operations = pcall(cjson.decode, operations_str)
if not success then
    return cjson.encode({
        success = false,
        error = "Invalid operations JSON"
    })
end

local current_value = redis.call('GET', key)
local current_obj

if not current_value or current_value == "" then
    current_obj = {}
else
    local parse_success, parsed = pcall(cjson.decode, current_value)
    if not parse_success or type(parsed) ~= 'table' then
        return cjson.encode({
            success = false,
            error = "Current value is not a valid JSON object"
        })
    end
    current_obj = parsed
end

local function get_nested(obj, path)
    local keys = {}
    for key in string.gmatch(path, "([^.]+)") do
        table.insert(keys, key)
    end
    
    local current = obj
    for i = 1, #keys - 1 do
        if type(current) ~= 'table' then
            return nil
        end
        current = current[keys[i]]
        if current == nil then
            return nil
        end
    end
    
    return current, keys[#keys]
end

local function set_nested(obj, path, value)
    local keys = {}
    for key in string.gmatch(path, "([^.]+)") do
        table.insert(keys, key)
    end
    
    local current = obj
    for i = 1, #keys - 1 do
        if type(current[keys[i]]) ~= 'table' then
            current[keys[i]] = {}
        end
        current = current[keys[i]]
    end
    
    current[keys[#keys]] = value
end


local function unset_nested(obj, path)
    local keys = {}
    for key in string.gmatch(path, "([^.]+)") do
        table.insert(keys, key)
    end
    
    local current = obj
    for i = 1, #keys - 1 do
        if type(current) ~= 'table' or current[keys[i]] == nil then
            return 
        end
        current = current[keys[i]]
    end
    
    current[keys[#keys]] = nil
end

if operations['$set'] and type(operations['$set']) == 'table' then
    for field, value in pairs(operations['$set']) do
        set_nested(current_obj, field, value)
    end
end

if operations['$unset'] and type(operations['$unset']) == 'table' then
    for i, field in ipairs(operations['$unset']) do
        if type(field) == 'string' then
            unset_nested(current_obj, field)
        end
    end
end

if operations['$inc'] and type(operations['$inc']) == 'table' then
    for field, amount in pairs(operations['$inc']) do
        if type(amount) ~= 'number' then
            return cjson.encode({
                success = false,
                error = string.format("$inc amount for field '%s' must be a number", field)
            })
        end
        
        local parent, last_key = get_nested(current_obj, field)
        local current_value = 0
        
        if parent and parent[last_key] ~= nil then
            if type(parent[last_key]) ~= 'number' then
                return cjson.encode({
                    success = false,
                    error = string.format("Cannot $inc field '%s': current value is not a number", field)
                })
            end
            current_value = parent[last_key]
        end
        
        set_nested(current_obj, field, current_value + amount)
    end
end

if operations['$concat'] and type(operations['$concat']) == 'table' then
    for field, value in pairs(operations['$concat']) do
        local parent, last_key = get_nested(current_obj, field)
        local current_value = parent and parent[last_key] or nil
        
        if current_value == nil then
            set_nested(current_obj, field, value)
        elseif type(current_value) == 'string' then
            if type(value) ~= 'string' then
                return cjson.encode({
                    success = false,
                    error = string.format("Cannot $concat field '%s': type mismatch (existing: string, new: %s)", field, type(value))
                })
            end
            set_nested(current_obj, field, current_value .. value)
        elseif type(current_value) == 'table' then
            if type(value) ~= 'table' then
                return cjson.encode({
                    success = false,
                    error = string.format("Cannot $concat field '%s': type mismatch (existing: array, new: %s)", field, type(value))
                })
            end
            local concatenated = {}
            for i, v in ipairs(current_value) do
                table.insert(concatenated, v)
            end
            for i, v in ipairs(value) do
                table.insert(concatenated, v)
            end
            set_nested(current_obj, field, concatenated)
        else
            return cjson.encode({
                success = false,
                error = string.format("Cannot $concat field '%s': current value is neither string nor array", field)
            })
        end
    end
end

if operations['$push'] and type(operations['$push']) == 'table' then
    for field, value in pairs(operations['$push']) do
        local parent, last_key = get_nested(current_obj, field)
        local current_value = parent and parent[last_key] or nil
        
        if current_value == nil then
            set_nested(current_obj, field, {value})
        elseif type(current_value) == 'table' then
            table.insert(current_value, value)
        else
            return cjson.encode({
                success = false,
                error = string.format("Cannot $push to field '%s': current value is not an array", field)
            })
        end
    end
end

local updated_str = cjson.encode(current_obj)
redis.call('SET', key, updated_str)

local update_count = redis.call('INCR', counter_key)

return cjson.encode({
    success = true,
    value = current_obj,
    update_count = update_count
})
    `
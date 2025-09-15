// 验证规则
const VALIDATION_RULES = {
    id: {
        required: true,
        pattern: /^P\d{7}$/,
        message: '编号格式必须为P开头加7位数字'
    },
    name: {
        required: true,
        minLength: 1,
        maxLength: 100,
        message: '名称长度必须在1-100个字符之间'
    },
    vector: {
        required: true,
        maxLength: 50,
        message: '载体类型不能为空且不超过50个字符'
    },
    target: {
        maxLength: 100,
        message: '目标基因不能超过100个字符'
    },
    tagged_protein: {
        maxLength: 50,
        message: '标签蛋白不能超过50个字符'
    },
    enzyme_sites: {
        maxLength: 255,
        message: '酶切位点不能超过255个字符'
    },
    source: {
        maxLength: 50,
        message: '来源不能超过50个字符'
    },
    concentration: {
        maxLength: 50,
        message: '浓度不能超过50个字符'
    },
    position: {
        maxLength: 10,
        pattern: /^[A-Z][0-9]+$/,
        message: '位置坐标格式必须为字母+数字，如A1'
    }
};

// 验证单个字段
export const validateField = (fieldName, value) => {
    const rule = VALIDATION_RULES[fieldName];
    if (!rule) return { valid: true };

    if (rule.required && !value) {
        return {
            valid: false,
            message: rule.message || `${fieldName}不能为空`
        };
    }

    if (rule.pattern && !rule.pattern.test(value)) {
        return {
            valid: false,
            message: rule.message
        };
    }

    if (rule.minLength && value.length < rule.minLength) {
        return {
            valid: false,
            message: rule.message
        };
    }

    if (rule.maxLength && value.length > rule.maxLength) {
        return {
            valid: false,
            message: rule.message
        };
    }

    return { valid: true };
};

// 验证整个表单
export const validatePlasmidForm = (formData) => {
    const errors = {};
    let isValid = true;

    Object.keys(VALIDATION_RULES).forEach(fieldName => {
        const result = validateField(fieldName, formData[fieldName]);
        if (!result.valid) {
            errors[fieldName] = result.message;
            isValid = false;
        }
    });

    return {
        isValid,
        errors
    };
};

// 格式化表单数据
export const formatPlasmidData = (formData) => {
    return {
        ...formData,
        concentration: formData.concentration.trim(),
        createTime: formData.createTime || new Date().toISOString().split('T')[0],
        status: formData.status || '正常'
    };
};

// 生成新的质粒ID
export const generatePlasmidId = (existingPlasmids) => {
    const lastId = existingPlasmids
        .map(p => parseInt(p.id.slice(1)))
        .sort((a, b) => b - a)[0] || 0;
    return `P${(lastId + 1).toString().padStart(7, '0')}`;
};

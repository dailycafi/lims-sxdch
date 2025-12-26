from typing import List, Dict, Any, Optional
from itertools import product
from app.models.project import Project

def generate_sample_codes_logic(
    project: Project,
    generation_params: Dict[str, Any]
) -> List[str]:
    """
    通用样本编号生成逻辑
    """
    def _parse_list(value):
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str):
            return [v.strip() for v in value.split(',') if v.strip()]
        return []

    cycles = _parse_list(generation_params.get("cycles"))
    test_types = _parse_list(generation_params.get("test_types"))
    primary = _parse_list(generation_params.get("primary"))
    backup = _parse_list(generation_params.get("backup"))
    
    clinic_subject_pairs = generation_params.get("clinic_subject_pairs") or []
    if not clinic_subject_pairs:
        subjects = _parse_list(generation_params.get("subjects"))
        clinic_codes = _parse_list(generation_params.get("clinic_codes")) or [""]
        for cc in clinic_codes:
            for subj in (subjects or [""]):
                clinic_subject_pairs.append({"clinic": cc, "subject": subj})
    
    if not clinic_subject_pairs:
        clinic_subject_pairs = [{"clinic": "", "subject": ""}]

    seq_time_pairs = generation_params.get("seq_time_pairs") or []
    if isinstance(seq_time_pairs, str):
        pairs = []
        for token in seq_time_pairs.split(','):
            token = token.strip()
            if not token: continue
            parts = token.split('/')
            seq = parts[0].strip() if len(parts) > 0 else ""
            tm = parts[1].strip() if len(parts) > 1 else ""
            pairs.append({"seq": seq, "time": tm})
        seq_time_pairs = pairs
    else:
        norm = []
        for p in seq_time_pairs:
            if isinstance(p, dict):
                norm.append({"seq": str(p.get("seq", "")).strip(), "time": str(p.get("time", "")).strip()})
        seq_time_pairs = norm

    rule = project.sample_code_rule or {}
    elements_rule = rule.get("elements", [])
    order_map = rule.get("order", {})
    elements = sorted([e for e in elements_rule], key=lambda x: order_map.get(x, 0))

    cycles = cycles or [""]
    test_types = test_types or [""]
    primary = primary or []
    backup = backup or []
    seq_time_pairs = seq_time_pairs or [{"seq": "", "time": ""}]

    def _part(el: str, clinic_code: str, subject: str, tt: str, st: dict, cycle: str, stype: str) -> str:
        if el == 'sponsor_code':
            return project.sponsor_project_code or ''
        if el == 'lab_code':
            return project.lab_project_code or ''
        if el == 'clinic_code':
            return clinic_code
        if el == 'subject_id':
            return subject
        if el == 'test_type':
            return tt
        if el == 'sample_seq':
            return st.get('seq', '')
        if el == 'sample_time':
            return st.get('time', '')
        if el == 'cycle_group':
            return cycle
        if el == 'sample_type':
            return stype
        return ''

    generated_codes: List[str] = []
    sample_types = primary + backup if (primary or backup) else [""]
    
    for cs_pair in clinic_subject_pairs:
        clinic_code = cs_pair.get("clinic", "")
        subject = cs_pair.get("subject", "")
        for tt, st, cycle, stype in product(test_types, seq_time_pairs, cycles, sample_types):
            parts = [_part(el, clinic_code, subject, tt, st, cycle, stype) for el in elements]
            parts = [p for p in parts if p != ""]
            if not parts:
                continue
            code = "-".join(parts)
            generated_codes.append(code)

    unique_codes = list(dict.fromkeys(generated_codes))
    return unique_codes

def parse_sample_code(
    project: Project,
    sample_code: str
) -> Dict[str, Any]:
    """
    根据项目规则解析样本编号中的元数据
    """
    rule = project.sample_code_rule or {}
    elements_rule = rule.get("elements", [])
    order_map = rule.get("order", {})
    
    # 获取按顺序排列的元素
    sorted_elements = sorted([e for e in elements_rule], key=lambda x: order_map.get(x, 0))
    
    # 分割编号
    parts = sample_code.split('-')
    
    metadata = {}
    
    # 建立字段映射 (el_id -> Sample model field)
    field_map = {
        'subject_id': 'subject_code',
        'test_type': 'test_type',
        'cycle_group': 'cycle_group',
        'sample_seq': 'collection_seq',
        'sample_time': 'collection_time',
        'sample_type': 'sample_type' # 这是一个逻辑字段，后续需要转换为 is_primary
    }
    
    # 尝试匹配每一部分
    # 注意：如果某些部分在生成时因为空被过滤掉了，这里解析可能会错位。
    # 这是一个已知限制，除非生成的编号包含固定数量的占位符。
    for i, el_id in enumerate(sorted_elements):
        if i < len(parts):
            val = parts[i]
            model_field = field_map.get(el_id)
            if model_field:
                metadata[model_field] = val
                
    # 处理 is_primary
    if 'sample_type' in metadata:
        stype = metadata['sample_type'].lower()
        # 简单逻辑：包含 'b' 的通常是备份 (backup)
        if 'b' in stype:
            metadata['is_primary'] = False
        else:
            metadata['is_primary'] = True
        del metadata['sample_type']
            
    return metadata


"""로컬 구매관리 스키마에 대한 보수적인 조건 해석.
질문별 정답을 하드코딩하지 않고 DB의 실제 ID/이름/날짜와 대조합니다.
지원하지 않는 항목/모호한 조건은 추측하지 않습니다. LLM 기반 자연어 SQL은 아닙니다.
"""
import calendar
import re
from datetime import date
from .documents import load_records, build_documents

UNAVAILABLE = {
    '이메일': r'이메일|이메일주소|e-?mail', '전화번호': r'전화|연락처',
    '주소': r'주소|공장\s*위치', '재질·무게': r'재질|무게|중량',
    '회전수': r'회전수|rpm', '보증': r'보증', '결제': r'결제|지불|입금|송금',
    '운송장': r'운송장|송장\s*번호', '해결일': r'해결일|해결\s*날짜|최종\s*해결|처리\s*완료일',
    '처리자': r'처리자|담당자|담당\s*처리', '평가 산출근거': r'점수.*(?:산출|평가\s*기간|평가\s*근거)',
    '실제 불량률': r'불량률|불량\s*수량',
    '재고': r'재고',
}

def decision(mode, reason, message, **extra):
    return {'mode':mode,'reason':reason,'message':message,**extra}

def period(text):
    """단일 연/월/일 또는 날짜 범위를 inclusive ISO 날짜로 변환합니다."""
    pattern=r'(\d{4})\s*(?:년\s*|[-/.])(\d{1,2})(?:\s*월(?:\s*(\d{1,2})\s*일)?|[-/.](\d{1,2}))'
    spans=[]
    for m in re.finditer(pattern,text):
        year,month=int(m[1]),int(m[2]);day=m[3] or m[4]
        start=date(year,month,int(day) if day else 1)
        end=start if day else date(year,month,calendar.monthrange(year,month)[1])
        spans.append((start.isoformat(),end.isoformat()))
    if not spans:
        for year,month in re.findall(r'\b(\d{4})[-/.](\d{1,2})(?![-/.\d])',text):
            year,month=int(year),int(month)
            spans.append((date(year,month,1).isoformat(),date(year,month,calendar.monthrange(year,month)[1]).isoformat()))
    if not spans:
        years=re.findall(r'(\d{4})\s*년',text)
        spans=[(date(int(y),1,1).isoformat(),date(int(y),12,31).isoformat()) for y in years]
    if len(spans)>1 and not re.search(r'부터|~|까지',text):
        raise ValueError('여러 날짜가 있습니다. 조회할 시작일과 종료일을 명확히 지정해 주세요.')
    if len(spans)>2:raise ValueError('날짜 조건이 복잡합니다. 한 기간씩 질문해 주세요.')
    if spans:
        start,end=spans[0][0],spans[-1][1]
        if start>end:raise ValueError('시작일이 종료일보다 늦습니다.')
        return [start,end]
    if re.search(r'오늘|어제|이번\s*달|지난\s*달|지난달|최근|작년|올해|지난주',text):
        raise ValueError('상대 날짜는 자동 추정하지 않습니다. 조회 연도·월·일을 지정해 주세요.')
    if re.search(r'\d{1,2}\s*월',text):raise ValueError('조회할 연도도 지정해 주세요.')
    return None

def plan(database,question,filters):
    text=question.strip();filters=dict(filters or {})
    for label,pattern in UNAVAILABLE.items():
        if re.search(pattern,text,re.I):
            return decision('reject','unsupported_field',f'근거 부족: 현재 스키마에서 {label} 항목의 값을 제공할 수 없습니다. 실제 정보가 존재하지 않는다는 의미는 아닙니다.')
    if re.search(r'날씨|김치찌개|수도는|파이썬|축구|여행|미분|적분|배터리|환율|휴가',text):
        return decision('reject','outside_scope','근거 부족: 현재 구매관리 데이터의 지원 범위 밖 질문입니다.')
    records,c_values,digest=load_records(database)
    docs=build_documents(records,c_values,database.name,digest)
    conditions={k:v for k,v in filters.items() if k!='document_type' and v is not None}
    # 숫자를 문자 포함 검색하지 않고 완전한 정수 ID로 대조합니다.
    for label,key,table in [('발주','order_id','orders'),('민원','complaint_id','complaint'),('납품','delivery_id','delivery')]:
        patterns=[rf'{label}\s*(?:(?:ID|아이디|번호)\s*)?[:#]?\s*(\d+)',rf'(\d+)\s*번\s*{label}']
        values={int(v) for p in patterns for v in re.findall(p,text,re.I)}
        if len(values)>1:return decision('clarify','multiple_ids','한 번에 조회할 ID 하나를 지정해 주세요.')
        if values:
            value=values.pop()
            if key in conditions and conditions[key]!=value:
                return decision('clarify','conflicting_conditions','질문의 ID와 전달된 필터가 다릅니다. 조건을 확인해 주세요.')
            conditions[key]=value
    for key,table in [('order_id','orders'),('complaint_id','complaint'),('delivery_id','delivery'),('supplier_id','supplier'),('part_id','part')]:
        if key in conditions and not any(r[key]==conditions[key] for r in records[table]):
            return decision('reject','unknown_id',f'근거 부족: 현재 DB에 {key}={conditions[key]} 기록이 없습니다.')
    supplier_names=re.findall(r'가상\s*[A-Za-z가-힣0-9]+사',text)
    for name in supplier_names:
        matches=[r for r in records['supplier'] if re.sub(r'\s+','',r['name'])==re.sub(r'\s+','',name)]
        if not matches:return decision('reject','unknown_supplier',f'근거 부족: 현재 DB에 {name} 협력사가 없습니다.')
        sid=matches[0]['supplier_id']
        if 'supplier_id' in conditions and conditions['supplier_id']!=sid:
            return decision('clarify','conflicting_conditions','협력사 조건이 여러 개이거나 필터와 다릅니다. 한 협력사를 지정해 주세요.')
        conditions['supplier_id']=sid
    parts=[r for r in records['part'] if r['part_name'].replace('(가상)','') in text]
    if len(parts)>1:return decision('clarify','multiple_parts','한 번에 조회할 부품 하나를 지정해 주세요.')
    if parts:
        pid=parts[0]['part_id']
        if 'part_id' in conditions and conditions['part_id']!=pid:
            return decision('clarify','conflicting_conditions','질문의 부품과 필터가 다릅니다.')
        conditions['part_id']=pid
    try:dates=period(text)
    except ValueError as error:return decision('clarify','invalid_or_ambiguous_date',str(error))
    price=bool(re.search(r'단가|unit_price',text,re.I))
    score=bool(re.search(r'[QDTEC]\s*점수|점수',text,re.I))
    complaint=bool(re.search(r'민원|클레임|불량|포장|긁힘|찍힘|스크래치|라벨|완충|작동\s*확인',text))
    order=bool(re.search(r'발주|주문|납품|입고|납기',text))
    if re.search(r'최저|가장\s*낮|평균|합계|총합|순위|비교',text):
        return decision('clarify','aggregate_not_supported','비교·집계 질문은 아직 지원하지 않습니다. 협력사·부품·발주를 지정해 개별 값을 조회해 주세요.')
    if price:kind='supplier_part'
    elif score:kind='supplier'
    elif complaint:kind='complaint'
    elif order:kind='order'
    elif filters.get('document_type'):kind=filters['document_type']
    else:return decision('clarify','unrecognized_intent','조회할 항목을 지정해 주세요. 현재는 저장 점수·등록 단가·발주/납품 수량·민원 검색을 지원합니다.')
    if kind=='order' and not re.search(r'수량|몇\s*개|납기|예정|발주일|주문일|납품일|상태|cost|비용|정보',text,re.I):
        return decision('clarify','unsupported_order_field','발주에서 조회할 수량·비용·날짜·상태 항목을 명확히 지정해 주세요.')
    if score and not re.search(r'[QDTEC]\s*(?:저장\s*)?점수',text,re.I):
        return decision('clarify','unsupported_score','조회할 저장 점수 Q/D/T/E 또는 C 계산값을 지정해 주세요.')
    if filters.get('document_type') and filters['document_type']!=kind:
        return decision('clarify','conflicting_document_type','질문의 항목과 document_type 필터가 다릅니다.')
    if price and not {'supplier_id','part_id'}<=conditions.keys():
        unknown=re.search(r'공급하는\s+(.+?)(?:의\s*(?:등록\s*)?단가|\s+(?:등록\s*)?단가)',text)
        if unknown and not parts:
            return decision('reject','unknown_part',f'근거 부족: 현재 DB에 {unknown[1]} 부품이 없습니다.')
        return decision('clarify','missing_price_conditions','등록 단가를 조회할 협력사와 DB에 등록된 부품을 함께 지정해 주세요.')
    if score and 'supplier_id' not in conditions:
        return decision('clarify','missing_supplier','점수를 조회할 협력사를 지정해 주세요.')
    if dates and kind in ['supplier','supplier_part','part']:
        return decision('reject','unsupported_history','근거 부족: 저장 점수·등록 단가의 과거 시점 이력은 현재 DB에 없습니다.')
    if kind=='order' and not conditions:
        return decision('clarify','missing_order_conditions','발주 ID 또는 협력사·부품 조건을 지정해 주세요.')
    delivery_word=bool(re.search(r'납품|입고',text))
    if dates and kind=='complaint' and delivery_word and not re.search(r'납품일|입고일|민원일|접수일',text):
        return decision('clarify','ambiguous_date_field','민원 접수일 기준인지 납품일 기준인지 명시해 주세요.')
    date_field=('complaint_date' if kind=='complaint' else
                'expected_date' if re.search(r'납기|예정',text) else
                'delivery_date' if delivery_word else 'order_date')
    if kind=='complaint' and re.search(r'납품일|입고일',text):date_field='delivery_date'
    candidates=[]
    for doc in docs:
        m=doc['metadata']
        if m['document_type']!=kind:continue
        matched=True
        for key,value in conditions.items():
            if key=='delivery_id' and kind=='order':ok=value in m.get('delivery_ids',[])
            else:ok=m.get(key)==value
            if not ok:matched=False;break
        if not matched:continue
        if dates:
            values=m.get('delivery_dates',[]) if date_field=='delivery_date' and kind=='order' else [m.get(date_field)]
            if not any(v and dates[0]<=v<=dates[1] for v in values):continue
        candidates.append(doc)
    if not candidates:return decision('reject','no_matching_records','근거 부족: 현재 DB에 ID·협력사·부품·날짜 조건을 모두 충족하는 기록이 없습니다.',conditions=conditions,date_range=dates,date_field=date_field)
    structured=kind in ['supplier','supplier_part','order','part'] or ('complaint_id' in conditions)
    if structured and len(candidates)>1:
        return decision('clarify','multiple_records','조건에 맞는 기록이 여러 개입니다. 발주 ID나 더 구체적인 날짜를 지정해 주세요.')
    if structured and dates and date_field=='delivery_date':
        # 한 문서의 누적 납품 수량을 특정 기간 납품량으로 오인하지 않게 보류합니다.
        return decision('clarify','delivery_period_aggregation','기간 내 납품 수량 합산은 아직 지원하지 않습니다. 발주 ID로 누적 납품 수량을 조회해 주세요.')
    return decision('structured' if structured else 'semantic','validated_conditions',
                    '원본 DB에서 조건과 항목을 확인했습니다.',documents=candidates,
                    conditions=conditions,date_range=dates,date_field=date_field,source_sha256=digest)

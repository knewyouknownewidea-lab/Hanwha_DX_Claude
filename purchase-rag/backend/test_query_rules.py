import unittest
from backend.query_rules import plan, period
from project_paths import DATABASE

class QueryRulesTest(unittest.TestCase):
    def route(self,q,filters=None):return plan(DATABASE,q,filters or {})
    def test_natural_ids_and_exact_conditions(self):
        for text in ['발주 번호: 1104의 수량 차이는?','1104번 발주의 남은 수량은?','발주ID 1104 납품 수량']:
            r=self.route(text)
            self.assertEqual(r['mode'],'structured')
            self.assertEqual([d['id'] for d in r['documents']],['order-1104'])
        self.assertEqual(self.route('발주 110의 수량')['reason'],'unknown_id')
        self.assertEqual(self.route('발주 1104 수량',{'order_id':1101})['reason'],'conflicting_conditions')
        self.assertEqual(self.route('가상 B사의 발주 1104 수량')['reason'],'no_matching_records')
        self.assertEqual(self.route('가상 Z사의 베어링 단가')['reason'],'unknown_supplier')
    def test_dates(self):
        self.assertEqual(period('2026-05-01부터 2026-05-31까지'),['2026-05-01','2026-05-31'])
        self.assertEqual(period('2026-05 발주'),['2026-05-01','2026-05-31'])
        r=self.route('2026년 5월 가상 A사의 연료 분사 밸브 발주 수량은?')
        self.assertEqual([d['id'] for d in r['documents']],['order-1004'])
        self.assertEqual(self.route('2025년 5월 가상 A사의 연료 분사 밸브 발주 수량')['reason'],'no_matching_records')
        for q in ['2026년 13월 발주 수량','5월 발주 수량','지난달 가상 A사 발주 수량','2026-05-31부터 2026-05-01까지 발주 수량']:
            self.assertEqual(self.route(q)['mode'],'clarify')
        r=self.route('2026년 6월 베어링 표면 찍힘 민원을 찾아줘')
        self.assertEqual(r['mode'],'semantic');self.assertEqual([d['id'] for d in r['documents']],['complaint-3004'])
        self.assertEqual(self.route('2026년 10월 18일 납품 관련 민원')['reason'],'ambiguous_date_field')
        self.assertEqual([d['id'] for d in self.route('납품일 2026년 10월 18일의 민원')['documents']],['complaint-3007'])
    def test_absence_and_ambiguity(self):
        self.assertEqual(self.route('발주 1101의 결제 완료일')['reason'],'unsupported_field')
        self.assertEqual(self.route('가상 A사의 베어링 제조사 보증 기간')['reason'],'unsupported_field')
        self.assertEqual(self.route('가상 A사의 베어링 등록 단가')['mode'],'structured')
        self.assertEqual(self.route('베어링 단가 알려줘')['mode'],'clarify')
        self.assertEqual(self.route('발주 1101과 발주 1104의 수량')['reason'],'multiple_ids')
        self.assertEqual(self.route('발주 1101 승인 담당 조직')['mode'],'clarify')
        # 민원에 원인 확인 요청이 있다는 것과 실제 근본 원인을 아는 것은 다릅니다.
        self.assertEqual(self.route('실린더 라이너 긁힘 원인 확인을 요청한 민원 찾아줘')['mode'],'semantic')

if __name__=='__main__':unittest.main()

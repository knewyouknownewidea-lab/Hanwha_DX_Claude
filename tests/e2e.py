"""브라우저 E2E 테스트 — 명세서 6장 시나리오와 10장 검증 기준을 실제 조작으로 확인한다.
실행: (서버 실행 후) python3 tests/e2e.py [http://localhost:5173] [스크린샷 폴더]
"""
import sys, os, re, tempfile
from playwright.sync_api import sync_playwright, expect

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp()
os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))

def ask(page, text):
    page.fill("#chat-input", text)
    page.press("#chat-input", "Enter")
    page.wait_for_function("() => !document.querySelector('.progress')", timeout=8000)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # 샌드박스는 외부 글꼴(Google Fonts)을 받을 수 없어 그 연결 실패는 제외한다
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_TUNNEL_CONNECTION_FAILED" not in m.text else None)
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(".eval-card")

    # 1. 3분할 비율
    boxes = [page.locator(f".panel-{k}").bounding_box() for k in "abc"]
    total = sum(b["width"] for b in boxes)
    ratios = [round(b["width"] / total * 100) for b in boxes]
    check("A/B/C 3분할 비율(30/40/30)", all(abs(r - t) <= 2 for r, t in zip(ratios, [30, 40, 30])), str(ratios))
    page.screenshot(path=f"{SHOTS}/01_initial.png")

    # 2. 협력사 선택 → 평가 카드 변경
    g1 = page.locator(".donut-sub").text_content()
    page.locator(".data-table tbody tr", has_text="업체 D").click()
    g2 = page.locator(".donut-sub").text_content()
    grade = page.locator(".donut-grade").text_content()
    check("협력사 선택 시 평가 카드 변경", g1 != g2 and grade == "C", f"{g1} → {g2}, 등급 {grade}")
    page.locator(".eval-basis-toggle").click()
    check("평가 근거·누락 데이터 표시", page.locator(".eval-missing").count() == 1 and "경영·ESG" in page.locator(".eval-missing").inner_text())
    page.locator(".eval-basis-toggle").click()

    # 3. 4개 탭
    counts = {}
    for t in ["구매조달", "원가-계약", "자재-공급관리", "협력업체"]:
        page.locator(".tab", has_text=t).click()
        counts[t] = page.locator(".data-table tbody tr").count()
    check("4개 데이터 탭 동작", all(v > 0 for v in counts.values()), str(counts))
    page.locator(".tab", has_text="구매조달").click()
    page.select_option("#select-purchaseOrders", "납기 지연")
    n_late = page.locator(".data-table tbody tr").count()
    check("필터(납기 지연)", 0 < n_late < counts["구매조달"], f"{n_late}건")
    page.select_option("#select-purchaseOrders", "all")
    page.locator(".tab", has_text="협력업체").click()

    # 4. 대표 질문 (품목 미선택) → 추가 질문 → 품목 선택
    q = "해당 품목의 과거 거래 업체를 등급, 납기 실적, 최근 단가와 함께 보여주어 품목별 후보 업체 표시해줘."
    ask(page, q)
    last = page.locator(".msg-ai").last
    check("품목 미선택 시 추가 질문", last.locator(".opt-chip").count() >= 5 and "어느 품목" in last.inner_text())
    check("추가 질문 단계에서는 C 미생성", page.locator(".empty-title").inner_text() == "분석 결과 대기 중")
    last.locator(".opt-chip", has_text="실린더 라이너").click()
    page.wait_for_function("() => !document.querySelector('.progress')")
    last = page.locator(".msg-ai").last
    txt = last.inner_text()
    check("품목 지정 후 분석·요약", "실린더 라이너" in txt and "거래 업체 4곳" in txt, txt.split("\n")[1][:80])
    check("데이터 출처 표시", "사용 데이터" in txt and "기준일" in txt)
    check("템플릿 4종 추천(①~④)", last.locator(".tpl-card").count() == 4 and last.locator(".tpl-badge", has_text="추천").count() == 1)
    check("템플릿 선택 전 C 대기 상태 유지", page.locator(".empty-title").count() == 1)
    check("규칙 기반 응답 표시", last.locator(".engine-rule").count() == 1)
    page.screenshot(path=f"{SHOTS}/02_templates.png")

    # 5. ① 업체별 비교표 선택 → C 표
    last.locator(".tpl-card", has_text="업체별 비교표").click()
    page.wait_for_selector(".result-table")
    rows = page.locator(".result-table tbody tr")
    names = [rows.nth(i).locator(".sticky-col .name").inner_text() for i in range(rows.count())]
    check("C에 업체별 비교표 생성", rows.count() == 4, ", ".join(names))
    body = page.locator(".result").inner_text()
    for label in ["단가 경쟁력", "납기 실적", "추가 검토가 필요한 위험 요소", "비교에 사용된 데이터와 평가 근거"]:
        check(f"표 아래 '{label}'", label in body)
    check("조건 상이 업체는 순위 제외", page.locator(".result-table tr.is-excluded").count() == 1)
    check("자동 확정 안 함 문구", "자동 확정되지 않습니다" in body)
    page.screenshot(path=f"{SHOTS}/03_table.png")

    # 6. 정렬
    page.locator(".result-table th", has_text="최근 단가").locator("button").click()
    first_after = page.locator(".result-table tbody tr").first.locator(".sticky-col .name").inner_text()
    check("비교표 정렬", first_after in ["업체 C", "업체 D", "업체 B", "업체 A"], f"단가 내림차순 첫 행 {first_after}")

    # 7. 같은 결과 다른 템플릿 (재분석 없이)
    rid_before = page.evaluate("() => document.querySelector('.result-head h3').textContent")
    for tid, sel in [("chart", ".chart-card"), ("cards", ".score-card"), ("report", ".report-doc"), ("table", ".result-table")]:
        page.locator(f".seg-btn[data-template='{tid}']").click()
        page.wait_for_selector(sel)
        check(f"템플릿 전환: {tid}", page.locator(sel).count() >= 1)
        if tid != "table":
            page.screenshot(path=f"{SHOTS}/04_{tid}.png")
    check("템플릿만 바꿔도 같은 결과", page.evaluate("() => document.querySelector('.result-head h3').textContent") == rid_before)

    # 차트 툴팁
    page.locator(".seg-btn[data-template='chart']").click()
    page.wait_for_selector(".chart svg rect[tabindex]")
    page.locator(".chart svg rect[tabindex]").first.hover()
    check("차트 툴팁", page.locator(".tooltip").count() >= 1)
    page.locator(".seg-btn[data-template='table']").click()

    # 8. 후속 질문 — 문맥 유지
    ask(page, "여기서 단가보다 납기를 우선하면 어떤 업체가 적합해?")
    last = page.locator(".msg-ai").last
    t2 = last.inner_text()
    check("후속 질문: 직전 품목 유지", "실린더 라이너" in t2 and "납기 우선" in t2, t2.split("\n")[1][:90])
    check("후속 질문: 현재 형식 유지 선택지", last.locator(".tpl-badge", has_text="현재 형식 유지").count() == 1)
    check("후속 질문: 선택 전 C 유지", "납기 우선" not in page.locator(".result-head h3").inner_text())
    last.locator(".tpl-card", has_text="현재 형식 유지").click()
    page.wait_for_selector(".result-table")
    check("후속 결과 C 반영", "납기 우선" in page.locator(".result-head h3").inner_text())
    page.screenshot(path=f"{SHOTS}/05_followup.png")

    # 9. 다른 대표 질문
    for qq, kind in [("납기 준수율이 낮은 협력사를 찾아줘.", "납기"), ("최근 단가가 상승한 품목을 보여줘.", "단가"), ("A등급 협력사의 품질 실적을 정리해 줘.", "A등급")]:
        ask(page, qq)
        last = page.locator(".msg-ai").last
        ok = last.locator(".tpl-card").count() >= 2
        check(f"질문 처리: {qq}", ok, last.inner_text().split("\n")[1][:70])
    page.locator(".msg-ai").last.locator(".tpl-card").first.click()
    page.wait_for_selector(".score-card")
    page.screenshot(path=f"{SHOTS}/06_grade_cards.png")

    # 10. 모르는 질문 → 추측하지 않음
    ask(page, "오늘 점심 메뉴 추천해줘")
    check("범위 밖 질문은 추측하지 않음", "추측해서 답하지 않습니다" in page.locator(".msg-ai").last.inner_text())

    # 11. 키워드 검색 → A 선택
    page.fill("#keyword-search", "고압 연료관")
    page.wait_for_selector(".kw-hit")
    n_hits = page.locator(".kw-hit").count()
    page.locator(".kw-hit").first.click()
    check("키워드 검색 → A 선택", n_hits > 0 and page.locator(".data-table tr.is-selected").count() == 1, f"{n_hits}건")
    check("선택 품목이 질문 문맥에 표시", "고압 연료관" in page.locator(".ctx-chips").inner_text())

    # 12. A에서 품목 선택 후 같은 대표 질문 → 바로 분석
    ask(page, q)
    t3 = page.locator(".msg-ai").last.inner_text()
    check("선택 품목으로 바로 분석", "A 영역에서 선택한 품목(고압 연료관)" in t3)

    # 13. 업로드 → 재계산 → 재분석 필요 표시
    page.locator(".msg-ai").last.locator(".tpl-card").first.click()
    page.wait_for_selector(".result-table")
    csv = "업체ID,협력사명,품질 평가 점수,불량률(%),기술·대응력 점수,경영·ESG 점수,심사 등급\nSUP-012,업체 L,60,4.5,50,40,B\nSUP-099,업체 신규,abc,1,70,70,A\n"
    path = os.path.join(SHOTS, "upload_suppliers.csv")
    open(path, "w", encoding="utf-8").write(csv)
    page.locator(".topbar .btn-primary").click()
    page.select_option("#import-dataset", "suppliers")
    page.set_input_files("#import-file", path)
    page.wait_for_selector(".validation")
    vt = page.locator(".validation").inner_text()
    check("업로드 검증(오류 행 걸러냄)", "반영 가능 1" in vt.replace("\n", " ") and "숫자가 아닙니다" in vt, vt.replace("\n", " ")[:120])
    page.locator(".modal-foot .btn-primary").click()
    page.wait_for_selector(".stale")
    check("데이터 변경 → 재분석 필요 표시", page.locator(".stale").count() == 1)
    page.locator(".tab", has_text="협력업체").click()
    page.locator(".data-table tbody tr", has_text="업체 L").click()
    check("업로드 반영 → 평가 재계산", page.locator(".donut-grade").text_content() in ["C", "D"], "업체 L 등급 " + page.locator(".donut-grade").text_content())
    page.locator(".stale button").click()
    page.wait_for_timeout(200)
    check("다시 분석 후 경고 해제", page.locator(".stale").count() == 0)
    page.screenshot(path=f"{SHOTS}/07_after_upload.png")

    check("콘솔 오류 없음", not errors, "; ".join(errors[:3]))

    # 14. 태블릿 — 탭 전환
    tab = browser.new_page(viewport={"width": 900, "height": 1180})
    tab.goto(URL, wait_until="domcontentloaded")
    tab.wait_for_selector(".panel-tabs")
    vis = [tab.locator(f".panel-{k}").is_visible() for k in "abc"]
    check("태블릿: 패널 탭 전환 UI", tab.locator(".panel-tabs").is_visible() and vis == [False, True, False], str(vis))
    tab.fill("#chat-input", "노즐 후보 업체 비교해 줘")
    tab.press("#chat-input", "Enter")
    tab.wait_for_selector(".msg-ai .tpl-card")
    tab.locator(".msg-ai .tpl-card").first.click()
    tab.wait_for_selector(".result-table")
    check("태블릿: 템플릿 선택 시 C로 이동", tab.locator(".panel-c").is_visible())
    tab.screenshot(path=f"{SHOTS}/08_tablet_c.png")
    sw = tab.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth")
    check("태블릿: 가로 스크롤 없음", sw)

    phone = browser.new_page(viewport={"width": 400, "height": 820})
    phone.goto(URL, wait_until="domcontentloaded")
    phone.wait_for_selector(".panel-tabs")
    check("휴대폰 폭: 가로 스크롤 없음", phone.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth"))
    phone.locator(".panel-tabs button", has_text="A 데이터").click()
    phone.screenshot(path=f"{SHOTS}/09_phone_a.png")
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} 통과 · 스크린샷: {SHOTS}")
sys.exit(1 if failed else 0)

import { useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import type { RecommendationPanelProps } from '../contracts'
import type { JourneyClient } from '../api/journey'
import { CriteriaForm } from './CriteriaForm'
import { useJourneyController } from './useJourneyController'
import { ComparisonView } from './comparison/ComparisonView'
import { useJourneyView } from './useJourneyView'

/** Pass Setayesh's exported component as Panel when it is published. */
export function JourneyFlow({ Panel, client }: { Panel?: ComponentType<RecommendationPanelProps>; client?: JourneyClient }) {
  const { state, panelProps, changeDraft, submit, clearVerification } = useJourneyController(client ? { client } : {})
  const view = useJourneyView()
  const searchRegion = useRef<HTMLElement>(null)
  const comparisonRegion = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current !== view) {
      (view === 'comparison' ? comparisonRegion : searchRegion).current?.focus()
      previousView.current = view
    }
  }, [view])
  return <>
    {/* Keep both subtrees and this single controller mounted across navigation. */}
    <section id="search" className="journey-route" ref={searchRegion} tabIndex={-1} hidden={view !== 'search'} aria-label="جست‌وجوی خرید">
    <CriteriaForm draft={state.draft} errors={state.fieldErrors} loading={state.status === 'loading'} onChange={changeDraft} onSubmit={submit} />
    <section className="foundation-note" aria-labelledby="results-title" aria-busy={state.status === 'loading'}>
      <h2 id="results-title">نتیجهٔ جست‌وجو</h2>
      <p><a href="#comparison">مقایسهٔ انتخاب‌ها ({new Intl.NumberFormat('fa-IR').format(state.comparison.length)})</a></p>
      <p role="status">{state.status === 'loading' ? 'در حال دریافت پیشنهادها…'
        : state.status === 'ready' ? Panel ? 'جست‌وجو انجام شد.' : 'نتیجه دریافت شد؛ نمایش پیشنهادها پس از اتصال بخش پیشنهادها فعال می‌شود.'
          : state.status === 'idle' ? 'معیارهای خرید را وارد کنید و جست‌وجو را آغاز کنید.' : 'جست‌وجو انجام نشد.'}</p>
      {state.error && <div className="journey-notice">
        <p role="alert">{state.error.error.message}</p>
        <button className="secondary-button" onClick={() => panelProps.onRetry(state.requestId, state.revision)}>تلاش دوباره</button>
      </div>}
      {state.notice && <p role="status" className="journey-notice">{state.notice}</p>}
      {state.selectedVerification && <div className="journey-notice">
        <p role="status">برنامهٔ پیش از مراجعه انتخاب شد؛ موجودی هنوز تأیید نشده است.</p>
        <button className="secondary-button" onClick={clearVerification}>بستن انتخاب برنامه</button>
      </div>}
      {/* This is the sole recommendation mounting boundary. No substitute UI. */}
      <div id="recommendation-root">{Panel && <Panel {...panelProps} />}</div>
    </section>
    </section>
    <section id="comparison" className="journey-route" ref={comparisonRegion} tabIndex={-1} hidden={view !== 'comparison'} aria-label="مقایسهٔ خرید">
      <ComparisonView response={state.response} selections={state.comparison} status={state.status} onComparisonChange={panelProps.onComparisonChange} />
    </section>
  </>
}

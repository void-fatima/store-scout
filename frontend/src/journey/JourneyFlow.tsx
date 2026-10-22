import type { ComponentType } from 'react'
import type { RecommendationPanelProps } from '../contracts'
import type { JourneyClient } from '../api/journey'
import { CriteriaForm } from './CriteriaForm'
import { useJourneyController } from './useJourneyController'

/** Pass Setayesh's exported component as Panel when it is published. */
export function JourneyFlow({ Panel, client }: { Panel?: ComponentType<RecommendationPanelProps>; client?: JourneyClient }) {
  const { state, panelProps, changeDraft, submit, clearVerification } = useJourneyController(client ? { client } : {})
  return <>
    <CriteriaForm draft={state.draft} errors={state.fieldErrors} loading={state.status === 'loading'} onChange={changeDraft} onSubmit={submit} />
    <section className="foundation-note" aria-labelledby="results-title" aria-busy={state.status === 'loading'}>
      <h2 id="results-title">نتیجهٔ جست‌وجو</h2>
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
  </>
}

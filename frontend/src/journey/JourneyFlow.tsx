import { useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import type { RecommendationPanelProps } from '../contracts'
import type { JourneyClient } from '../api/journey'
import { CriteriaForm } from './CriteriaForm'
import { useJourneyController } from './useJourneyController'
import { ComparisonView } from './comparison/ComparisonView'
import { useJourneyView } from './useJourneyView'
import { BuyingGuide, LandingHero } from '../shell/Landing'
import { usePanelHash } from '../features/recommendation/usePanelHash'
import { parsePanelRoute } from '../features/recommendation/presentation'

type Controller = ReturnType<typeof useJourneyController>
type FlowProps = { Panel?: ComponentType<RecommendationPanelProps>; client?: JourneyClient; controller?: Controller }

/** Mount a controlled result component through the existing Panel boundary. */
export function JourneyFlow(props: FlowProps) {
  return props.controller ? <JourneyRoutes {...props} controller={props.controller} /> : <StandaloneJourneyFlow {...props} />
}
function StandaloneJourneyFlow(props: FlowProps) {
  const controller = useJourneyController(props.client ? { client: props.client } : {})
  return <JourneyRoutes {...props} controller={controller} />
}
function JourneyRoutes({ Panel, controller }: FlowProps & { controller: Controller }) {
  const { state, panelProps, changeDraft, submit, clearVerification } = controller
  const view = useJourneyView()
  const hash = usePanelHash()
  const activeResults = !!Panel && state.status !== 'idle'
  const explanation = !!Panel && state.status === 'ready' && !!parsePanelRoute(hash)
  const searchRegion = useRef<HTMLElement>(null)
  const comparisonRegion = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current !== view) {
      (view === 'comparison' ? comparisonRegion : searchRegion).current?.focus()
      previousView.current = view
    }
  }, [view])
  useEffect(() => {
    if (hash === '#edit-search') document.getElementById('criteria-query')?.focus()
  }, [hash])
  return <>
    {/* Keep both subtrees and this single controller mounted across navigation. */}
    <section id="search" className="journey-route" ref={searchRegion} tabIndex={-1} hidden={view !== 'search'} aria-label="جست‌وجوی خرید">
    <div hidden={explanation} className={activeResults && hash !== '#edit-search' && state.status === 'ready' ? 'search-controls compact-on-mobile' : 'search-controls'}>
      <LandingHero />
      <CriteriaForm draft={state.draft} errors={state.fieldErrors} loading={state.status === 'loading'} onChange={changeDraft} onSubmit={submit} />
    </div>
    <section className={Panel ? 'production-results' : 'foundation-note search-results'} hidden={state.status === 'idle' && !state.notice} aria-label="نتیجهٔ جست‌وجو">
      {!Panel && <>
      <h2 id="results-title">نتیجهٔ جست‌وجو</h2>
      <p><a href="#comparison">مقایسهٔ انتخاب‌ها ({new Intl.NumberFormat('fa-IR').format(state.comparison.length)})</a></p>
      <p role="status">{state.status === 'loading' ? 'در حال دریافت پیشنهادها…'
        : state.status === 'ready' ? Panel ? 'جست‌وجو انجام شد.' : 'نتیجه دریافت شد؛ نمایش پیشنهادها پس از اتصال بخش پیشنهادها فعال می‌شود.'
          : state.status === 'idle' ? 'معیارهای خرید را وارد کنید و جست‌وجو را آغاز کنید.' : 'جست‌وجو انجام نشد.'}</p>
      {state.error && <div className="journey-notice">
        <p role="alert">{state.error.error.message}</p>
        <button className="secondary-button" onClick={() => panelProps.onRetry(state.requestId, state.revision)}>تلاش دوباره</button>
      </div>}
      </>}
      {state.notice && <p role="status" className="journey-notice">{state.notice}</p>}
      {state.selectedVerification && <div className="journey-notice">
        <p role="status">برنامهٔ پیش از مراجعه انتخاب شد؛ موجودی هنوز تأیید نشده است.</p>
        <button className="secondary-button" onClick={clearVerification}>بستن انتخاب برنامه</button>
      </div>}
      {/* This is the sole recommendation mounting boundary. */}
      <div id="recommendation-root">{Panel && <Panel {...panelProps} />}</div>
    </section>
    <div hidden={activeResults && hash !== '#guide'}><BuyingGuide /></div>
    </section>
    <section id="comparison" className="journey-route" ref={comparisonRegion} tabIndex={-1} hidden={view !== 'comparison'} aria-label="مقایسهٔ خرید">
      <ComparisonView response={state.response} selections={state.comparison} status={state.status} onComparisonChange={panelProps.onComparisonChange} />
    </section>
  </>
}

import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import './styles.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://izlqupagcqjtjfirnfz.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_fxzG96LLwsPJTbbgvTN9kg_93NLO40N'
)

const tr = {
  pl: {
    dashboard:'Dashboard', requests:'Zgłoszenia', planned:'Planowane akcje / Serwisy', archive:'Archiwum', trash:'Kosz', settings:'Ustawienia',
    newRequests:'Nowe zgłoszenia', acceptedNoDate:'Przyjęte bez daty', current:'Bieżące', overdue:'Opóźnione', plannedActions:'Planowane akcje / Serwisy',
    login:'Zaloguj admina', logout:'Wyloguj', preview:'Tryb podglądu', admin:'Administrator',
    search:'Szukaj po numerze, temacie, mailu, firmie...', allowedDomains:'Dozwolone domeny', allowedEmails:'Dodatkowe adresy',
    addDomain:'Dodaj domenę', addEmail:'Dodaj adres', systemMail:'Adres zgłoszeń', owner:'Twórca / support',
    statusNew:'Nowe', statusAccepted:'Przyjęte', statusPlanned:'Zaplanowane', statusInProgress:'W realizacji', statusDone:'Wykonane', statusClosed:'Zamknięte', statusOverdue:'Opóźnione',
    viewAll:'Zobacz wszystkie', question:'ZAPYTANIE O APLIKACJĘ SlawOS', loading:'Ładowanie danych z Supabase...'
  },
  cs: {
    dashboard:'Přehled', requests:'Požadavky', planned:'Plánované akce / Servisy', archive:'Archiv', trash:'Koš', settings:'Nastavení',
    newRequests:'Nové požadavky', acceptedNoDate:'Přijaté bez data', current:'Aktuální', overdue:'Zpožděné', plannedActions:'Plánované akce / Servisy',
    login:'Přihlásit admina', logout:'Odhlásit', preview:'Režim náhledu', admin:'Administrátor',
    search:'Hledat podle čísla, tématu, e-mailu, firmy...', allowedDomains:'Povolené domény', allowedEmails:'Další adresy',
    addDomain:'Přidat doménu', addEmail:'Přidat adresu', systemMail:'Adresa pro požadavky', owner:'Tvůrce / podpora',
    statusNew:'Nové', statusAccepted:'Přijaté', statusPlanned:'Naplánované', statusInProgress:'V realizaci', statusDone:'Hotovo', statusClosed:'Uzavřeno', statusOverdue:'Zpožděné',
    viewAll:'Zobrazit vše', question:'DOTAZ K APLIKACI SlawOS', loading:'Načítání dat ze Supabase...'
  }
}

const fallbackItems = [
  {id:'OS-26-117', module:'request', status:'new', title:'Brak chłodzenia w pomieszczeniu biurowym', sender:'jan.kowalski@firma.pl', received:'22.05.2026 14:32'},
  {id:'OS-26-116', module:'request', status:'new', title:'Awaria klimatyzacji – budynek A', sender:'serwis@cooltech.pl', received:'22.05.2026 13:58'},
  {id:'OS-26-110', module:'request', status:'accepted', title:'Wyciek wody z jednostki klimatyzacyjnej', sender:'technik@marf.cz', received:'22.05.2026 10:18'},
  {id:'OS-26-107', module:'request', status:'planned', title:'Przegląd klimatyzacji', date:'2026-05-22', sender:'admin@marf.cz'},
  {id:'OS-26-098', module:'request', status:'overdue', title:'Naprawa klimatyzacji', date:'2026-05-19', sender:'recepce@firma.cz'},
  {id:'PA-26-015', module:'planned', status:'planned', title:'Przegląd roczny HVAC', date:'2026-05-30', company:'ABC Serwis s.r.o.'},
  {id:'PA-26-014', module:'planned', status:'planned', title:'Serwis agregatu wody lodowej', date:'2026-06-05', company:'CoolTech s.r.o.'}
]

const defaultSettings = {
  allowedDomains:['@marf.cz'],
  allowedEmails:['servis@partner.cz'],
  systemMail:'slawos@slawo.art',
  ownerMail:'servis@slawo.art',
  subscriptionStatus:'active',
  expiresAt:null
}

const SETTINGS_KEY = 'slawos_settings_v07'

function normalizeTicket(row) {
  return {
    id: `OS-${String(row.id).padStart(3, '0')}`,
    module: 'request',
    status: row.status || 'new',
    title: row.title || 'Bez tytułu',
    sender: row.sender || 'Supabase',
    received: row.created_at ? new Date(row.created_at).toLocaleString('pl-PL') : '',
    date: row.date || null,
    company: row.company || null
  }
}

function statusText(t, s){
  return ({new:t.statusNew, accepted:t.statusAccepted, planned:t.statusPlanned, in_progress:t.statusInProgress, done:t.statusDone, closed:t.statusClosed, overdue:t.statusOverdue}[s] || s)
}

function App(){
  const [lang,setLang] = useState(localStorage.getItem('slawos_lang') || 'pl')
  const [view,setView] = useState('dashboard')
  const [admin,setAdmin] = useState(sessionStorage.getItem('slawos_admin') === '1')
  const [settings,setSettings] = useState(() => JSON.parse(localStorage.getItem(SETTINGS_KEY) || JSON.stringify(defaultSettings)))
  const [items,setItems] = useState(fallbackItems)
  const [loading,setLoading] = useState(true)
  const [q,setQ] = useState('')
  const [domain,setDomain] = useState('')
  const [email,setEmail] = useState('')
  const t = tr[lang]

  useEffect(()=>localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),[settings])
  useEffect(()=>localStorage.setItem('slawos_lang', lang),[lang])

  useEffect(() => {
    loadTickets()
    const channel = supabase
      .channel('tickets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => loadTickets())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadTickets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase tickets error:', error)
      setItems(onlineTickets.length ? onlineTickets : fallbackItems)
    } else {
      const onlineTickets = (data || []).map(ticket => ({
  id: ticket.id,
  module: 'request',
  status: ticket.status || 'new',
  title: ticket.title,
  sender: 'supabase@system.local',
  received: new Date(ticket.created_at).toLocaleString()
}))
      setItems(onlineTickets.length ? onlineTickets : fallbackItems)
    }
    setLoading(false)
  }

  const filteredItems = useMemo(()=>{
    const s=q.toLowerCase()
    return items.filter(i=>!s || [i.id,i.title,i.sender,i.company,i.status].join(' ').toLowerCase().includes(s))
  },[items,q])

  function login(){
    if(admin){ sessionStorage.removeItem('slawos_admin'); setAdmin(false); return }
    if(prompt('Hasło admina / Heslo admina:') === '1234'){ sessionStorage.setItem('slawos_admin','1'); setAdmin(true) }
    else alert('Nieprawidłowe hasło.')
  }

  function addDomain(){
    if(!admin || !domain.trim()) return
    setSettings(d=>({...d, allowedDomains:[...new Set([...d.allowedDomains, domain.trim()])]}))
    setDomain('')
  }

  function addEmail(){
    if(!admin || !email.trim()) return
    setSettings(d=>({...d, allowedEmails:[...new Set([...d.allowedEmails, email.trim()])]}))
    setEmail('')
  }

  const count = fn => filteredItems.filter(fn).length
  const newReq = filteredItems.filter(i=>i.status==='new')
  const columns = [
    {title:t.acceptedNoDate, cls:'yellow', filter:i=>i.status==='accepted'},
    {title:t.current, cls:'green', filter:i=>i.module==='request' && ['planned','in_progress'].includes(i.status)},
    {title:t.overdue, cls:'red', filter:i=>i.status==='overdue'},
    {title:t.plannedActions, cls:'violet', filter:i=>i.module==='planned' && i.status!=='overdue'}
  ]

  return <div className="app">
    <aside className="sidebar laser">
      <div className="brand"><div className="logoS">S</div><div><div className="brandName">Slaw<span>OS</span></div><p>Your workflow operating system</p></div></div>
      <nav>
        {[[ 'dashboard','▦',t.dashboard ],[ 'requests','⚠',t.requests ],[ 'planned','⌘',t.planned ],[ 'archive','▰',t.archive ],[ 'trash','⌫',t.trash ],[ 'settings','⚙',t.settings ]].map(([id,ico,label])=>
          <button key={id} onClick={()=>setView(id)} className={view===id?'active':''}><span>{ico}</span>{label}</button>
        )}
      </nav>
      <div className="mode">◉ {admin ? t.admin : t.preview}</div>
      <footer>
        <div>SlawOS v0.7 by <b>SLAWO</b></div>
        <a href={`mailto:${settings.ownerMail}?subject=${encodeURIComponent(t.question)}`}>{settings.ownerMail}</a>
        <small>{t.systemMail}: {settings.systemMail}</small>
      </footer>
    </aside>

    <main>
      <header>
        <div><div className="kicker">SLAWOS ONLINE + SUPABASE</div><h1>{view==='dashboard'?t.dashboard.toUpperCase():(t[view]||view)}</h1></div>
        <div className="topActions">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search}/>
          <div className="langs"><button className={lang==='pl'?'on':''} onClick={()=>setLang('pl')}>🇵🇱</button><button className={lang==='cs'?'on':''} onClick={()=>setLang('cs')}>🇨🇿</button></div>
          <button onClick={login} className={admin?'logout':'primary'}>{admin?t.logout:t.login}</button>
        </div>
      </header>

      {view==='dashboard' && <>
        {loading && <div className="loading">{t.loading}</div>}
        <section className="stats">
          <Stat label={t.newRequests} n={count(i=>i.status==='new')} color="blue"/>
          <Stat label={t.acceptedNoDate} n={count(i=>i.status==='accepted')} color="yellow"/>
          <Stat label={t.current} n={count(i=>i.module==='request' && ['planned','in_progress'].includes(i.status))} color="green"/>
          <Stat label={t.overdue} n={count(i=>i.status==='overdue')} color="red"/>
          <Stat label={t.plannedActions} n={count(i=>i.module==='planned')} color="violet"/>
        </section>
        <section className="newPanel laser">
          <div className="panelHead"><h2>✉ {t.newRequests}</h2><span>{newReq.length} nowych</span></div>
          <table><thead><tr><th>ID</th><th>Temat</th><th>Od</th><th>Wpłynęło</th></tr></thead><tbody>
            {newReq.map(i=><tr key={i.id}><td>{i.id}</td><td>{i.title}</td><td>{i.sender}</td><td>{i.received}</td></tr>)}
          </tbody></table>
        </section>
        <section className="columns">
          {columns.map(c=>{
            const list=filteredItems.filter(c.filter)
            return <div className={`column ${c.cls}`} key={c.title}>
              <div className="columnHead"><h3>{c.title}</h3><b>{list.length}</b></div>
              {list.slice(0,4).map(i=><Card key={i.id} item={i} text={statusText(t,i.status)}/>)}
              <button className="linkBtn">{t.viewAll} →</button>
            </div>
          })}
        </section>
      </>}

      {view==='settings' && <section className="settings laser">
        <h2>{t.settings}</h2>
        <div className="settingsGrid">
          <div><h3>{t.allowedDomains}</h3><div className="line"><input value={domain} onChange={e=>setDomain(e.target.value)} placeholder="@marf.cz"/><button disabled={!admin} onClick={addDomain}>{t.addDomain}</button></div>{settings.allowedDomains.map(x=><span className="pill" key={x}>{x}</span>)}</div>
          <div><h3>{t.allowedEmails}</h3><div className="line"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="jan@gmail.com"/><button disabled={!admin} onClick={addEmail}>{t.addEmail}</button></div>{settings.allowedEmails.map(x=><span className="pill" key={x}>{x}</span>)}</div>
          <div><h3>SaaS / Abonament</h3><p>Status: <b>{settings.subscriptionStatus}</b></p><p>Ważność: <b>{settings.expiresAt || 'bezterminowo'}</b></p><small>Struktura gotowa pod trial 30 dni i konto terminowe.</small></div>
        </div>
      </section>}
      {view!=='dashboard' && view!=='settings' && <section className="settings laser"><h2>{t[view]}</h2><p>Ten widok będzie rozwijany po podpięciu pełnego modelu danych Supabase.</p></section>}
    </main>
  </div>
}

function Stat({label,n,color}){ return <div className={`stat ${color}`}><span>{label}</span><b>{n}</b></div> }
function Card({item,text}){ return <div className="card"><small>{item.id}</small><strong>{item.title}</strong><p>{item.date||item.received||'bez daty'}</p><span>{text}</span></div> }

createRoot(document.getElementById('root')).render(<App/>)

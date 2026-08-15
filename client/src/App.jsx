import Chat from './components/Chat'
import Admin from './components/Admin'

// No router library — this app only ever has two pages, so a plain
// pathname check keeps things simple. Vite's dev server (and most static
// hosts) already fall back to index.html for unknown paths, so visiting
// /admin directly works.
function App() {
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'
  return isAdmin ? <Admin /> : <Chat />
}

export default App

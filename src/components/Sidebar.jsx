import { NavLink } from 'react-router-dom'

function Sidebar({ menus }) {
  return (
    <aside className="on-dark flex w-full shrink-0 flex-col bg-aspal-950 px-4 py-4 text-white md:min-h-screen md:w-64 md:px-5 md:py-6">
      <div className="mb-4 flex items-center md:mb-8 md:justify-center md:border-b md:border-aspal-800 md:pb-6">
        <img
          src="/logo.webp"
          alt="Andra Copotan Makassar"
          width="600"
          height="600"
          className="h-14 w-14 shrink-0 md:h-40 md:w-40"
        />
      </div>

      <nav aria-label="Menu utama" className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
        {menus.map((menu) => (
          <NavLink
            key={menu.to}
            to={menu.to}
            className={({ isActive }) =>
              `block shrink-0 rounded-md px-4 py-3 text-left text-sm md:w-full ${
                isActive ? 'nav-active bg-lemon-400 font-bold text-aspal-950' : 'text-aspal-300 hover:bg-aspal-800 hover:text-white'
              }`
            }
          >
            {menu.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HabitDiary from './habit.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HabitDiary />
  </StrictMode>,
)

export const $ = (id: string) => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element: ${id}`)
  return el
}

export function setStatus(msg: string) {
  $("status").textContent = msg
}

export function setCount(v: string) {
  $("count").textContent = v
}

export function showLoggedOutUI() {
  $("googleLogin").style.display = "inline-block"
  $("logoutBtn").style.display = "none"
  $("userInfo").style.display = "none"

  ;($("sendOp") as HTMLButtonElement).disabled = true
  ;($("refreshCount") as HTMLButtonElement).disabled = true

  $("eoa").textContent = ""
  $("smartAccount").textContent = ""
}

export function showLoggedInUI(owner: string, smartAccount: string) {
  $("googleLogin").style.display = "none"
  $("logoutBtn").style.display = "inline-block"
  $("userInfo").style.display = "block"

  ;($("sendOp") as HTMLButtonElement).disabled = false
  ;($("refreshCount") as HTMLButtonElement).disabled = false

  $("eoa").textContent = owner
  $("smartAccount").textContent = smartAccount
}

export function log(msg: string) {
  const container = $("logContent")
  const entry = document.createElement("div")
  entry.textContent = msg
  container.appendChild(entry)

  const panel = $("logPanel")
  panel.scrollTop = panel.scrollHeight
}

export function makeLogPanelDraggable() {
  const panel = $("logPanel") as HTMLDivElement
  let offsetX = 0
  let offsetY = 0
  let dragging = false

  panel.addEventListener("mousedown", (e) => {
    if (e.clientY - panel.getBoundingClientRect().top > 40) return
    dragging = true
    offsetX = e.clientX - panel.offsetLeft
    offsetY = e.clientY - panel.offsetTop
  })

  document.addEventListener("mouseup", () => {
    dragging = false
  })

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return
    panel.style.position = "fixed"
    panel.style.left = `${e.clientX - offsetX}px`
    panel.style.top = `${e.clientY - offsetY}px`
  })
}

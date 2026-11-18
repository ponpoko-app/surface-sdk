export function setFieldError(input, message, error) {
  if (!input.id || !message.id) throw new TypeError("The input and its error message need unique IDs.");
  const descriptions = new Set((input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
  if (error) descriptions.add(message.id);
  else descriptions.delete(message.id);
  if (descriptions.size) input.setAttribute("aria-describedby", [...descriptions].join(" "));
  else input.removeAttribute("aria-describedby");
  if (error) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  message.hidden = !error;
  message.textContent = error;
}

export function setStatus(region, state, message) {
  region.dataset.state = state;
  region.textContent = message;
}

export function setButtonBusy(button, busy, label, busyLabel) {
  button.disabled = busy;
  if (busy) button.setAttribute("aria-busy", "true");
  else button.removeAttribute("aria-busy");
  button.textContent = busy ? busyLabel : label;
}

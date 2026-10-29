import {solveLevel} from '../solve-api.js';
window.catSolver = Object.freeze({solve:solveLevel});
const level = document.getElementById('level'), output = document.getElementById('output');
const button = document.getElementById('solve'), sample = document.getElementById('sample');
const status = document.getElementById('status'), seconds = document.getElementById('seconds');
level.addEventListener('input', () => { output.value = ''; status.textContent = 'Sẵn sàng.'; });
button.onclick = async () => {
  button.disabled = sample.disabled = level.disabled = seconds.disabled = true; status.textContent = 'Đang giải…'; output.value = '';
  try {
    const result = await solveLevel(level.value, {timeoutSeconds:Number(seconds.value)});
    output.value = JSON.stringify(result, null, 2); status.textContent = result.status;
  } catch (error) { output.value = JSON.stringify({status:'Error',message:error.message,moves:[]},null,2); status.textContent = 'Error'; }
  finally { button.disabled = sample.disabled = level.disabled = seconds.disabled = false; }
};
sample.onclick = async () => {
  try { const response = await fetch('../samples/Level00001.json'); if(!response.ok) throw Error(`HTTP ${response.status}`); level.value = await response.text(); output.value = ''; status.textContent = 'Đã tải level mẫu.'; }
  catch (error) { status.textContent = error.message; }
};

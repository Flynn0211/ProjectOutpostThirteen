export function showToast(title: string, body: string = "") {
    window.dispatchEvent(new CustomEvent("show-toast", { 
        detail: { title, body } 
    }));
}

using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace Satella.Desktop;

public partial class MainWindow : Window
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;

    public MainWindow()
    {
        InitializeComponent();
        SourceInitialized += OnSourceInitialized;
        Loaded += OnLoaded;
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        try
        {
            var hwnd = new WindowInteropHelper(this).Handle;
            int dark = 1;
            DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
            int captionColor = 0x00050803; // COLORREF BGR for #030805
            DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));
        }
        catch
        {
            // Ignore on older Windows versions
        }
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SatellaADStudio",
                "WebView2");

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await BrowserView.EnsureCoreWebView2Async(env);

            BrowserView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            BrowserView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            BrowserView.CoreWebView2.NavigationCompleted += (_, _) =>
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
            };

            BrowserView.Source = new Uri(ApiHost.BaseUrl);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Ошибка инициализации WebView2: {ex.Message}", "Satella AD Studio", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
}

using System.Windows;

namespace Satella.Desktop;

public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        await ApiHost.StartAsync();
        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        await ApiHost.StopAsync();
        base.OnExit(e);
    }
}

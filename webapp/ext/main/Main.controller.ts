import Controller from "sap/fe/core/PageController";
import ODataListBinding from "sap/ui/model/odata/v4/ODataListBinding";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

export default class Main extends Controller {
  /**
   * Called when the controller is initialized.
   **/
  public onInit(): void {
    super.onInit();
  }

  /**
   * Called when the value help of the user search input is triggered.
   * Fetches data from the OData service
   * Force type
   **/
  public async onUserSearchHelp(): Promise<void> {
    const oModel = this.getAppComponent().getModel() as ODataModel;

    if (!oModel) {
      throw new Error("OData Model not found");
    }

    try {
      debugger;

      const oBinding = oModel.bindList("/UserSearchHelp") as ODataListBinding;

      // requestContexts là async → phải await
      const aContexts = await oBinding.requestContexts(0, 1000);

      const aData = aContexts.map((oContext) => oContext.getObject());

      console.log("CDS Data:", aData);
    } catch (error) {
      console.error("Error fetching CDS data:", error);
    }
  }

  /**
   * Called before the view is re-rendered.
   **/
  // public  onBeforeRendering(): void {
  //
  //  }
  /**
   * Called after the view has been rendered.
   **/
  // public  onAfterRendering(): void {
  //
  //  }
  /**
   * Called when the controller is destroyed.
   **/
  // public onExit(): void {
  //
  //  }
}
